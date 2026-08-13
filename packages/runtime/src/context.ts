import { reactive, type InjectionKey } from 'vue'
import {
  ActionRegistry,
  DataSourceManager,
  EventEngine,
  JexlExpressionEngine,
  MemoryStorage,
  type ActionContext,
  type EventAction,
  type ExpressionContext,
  type HttpClient,
  type IEventEngine,
  type IExpressionEngine,
  type StorageLike,
} from '@lowcode/core'
import {
  isExpressionBinding,
  isStaticBinding,
  type Binding,
  type LoopConfig,
  type PageNode,
  type PageSchema,
} from '@lowcode/schema'
import type { IComponentResolver } from './resolver'

/** RuntimeRenderer provide 的运行时上下文 key（物料组件通过它读取弹窗等状态） */
export const RUNTIME_CONTEXT_KEY: InjectionKey<RuntimeContext> = Symbol('lc.runtimeContext')

export interface RuntimeContextOptions {
  schema: PageSchema
  resolver: IComponentResolver
  actionRegistry: ActionRegistry
  expression?: IExpressionEngine
  http?: HttpClient
  storage?: StorageLike
  /** 页面变量初始值 */
  variables?: Record<string, unknown>
  /** 全局上下文（表达式 global 作用域） */
  globalContext?: Record<string, unknown>
  /** 属性修改回调：编辑器用它走历史，预览模式不传则走本地 override */
  onSetNodeProp?: (nodeId: string, prop: string, value: unknown) => void
  navigate?: (route: string) => void
  request?: ActionContext['request']
}

export interface LoopResolution {
  items: unknown[]
  itemName: string
  indexName?: string
}

/**
 * 运行时上下文：一个页面的所有运行时能力在这里汇聚。
 * - 表达式引擎
 * - 数据源管理器（状态驱动 UI）
 * - 事件引擎（动作链）
 * - 页面变量 / 弹窗状态（Vue reactive）
 */
export class RuntimeContext {
  readonly schema: PageSchema
  readonly resolver: IComponentResolver
  readonly expression: IExpressionEngine
  readonly datasource: DataSourceManager
  readonly eventEngine: IEventEngine
  readonly variables: Record<string, unknown> = reactive({})
  readonly dialogs: Record<string, boolean> = reactive({})
  /** 属性覆盖（预览模式下的本地状态，可响应式驱动 UI） */
  readonly overrides: Record<string, Record<string, unknown>> = reactive({})

  private state: Record<string, unknown> = reactive({})
  private options: RuntimeContextOptions

  constructor(options: RuntimeContextOptions) {
    this.options = options
    this.schema = options.schema
    this.resolver = options.resolver
    this.expression = options.expression ?? new JexlExpressionEngine()
    this.datasource = new DataSourceManager({
      http: options.http,
      storage: options.storage ?? new MemoryStorage(),
      variables: options.variables,
    })
    for (const source of options.schema.dataSources) {
      this.datasource.register(source)
    }
    for (const variable of options.schema.variables) {
      this.variables[variable.name] = variable.value
    }
    this.eventEngine = new EventEngine({ registry: options.actionRegistry })
  }

  /** 初始化：加载数据源、执行挂载规则 */
  async init(): Promise<void> {
    await this.datasource.loadAll()
  }

  /** 构建表达式上下文：local/loop/page/datasource/global 五级作用域 */
  buildExpressionContext(loop?: { itemName: string; indexName?: string; item: unknown; index: number }): ExpressionContext {
    const local: Record<string, unknown> = {}
    if (loop) {
      local[loop.itemName] = loop.item
      if (loop.indexName) local[loop.indexName] = loop.index
    }
    return {
      local,
      page: this.variables,
      datasource: this.datasource.getAllData(),
      global: this.options.globalContext ?? {},
    }
  }

  /** 创建动作执行上下文 */
  createActionContext(partial: Partial<ActionContext> = {}): ActionContext {
    const base: ActionContext = {
      expression: this.expression,
      expressionContext: this.buildExpressionContext(),
      datasource: this.datasource,
      schema: this.schema,
      getState: () => this.state,
      setState: (key, value) => {
        this.state[key] = value
      },
      navigate: this.options.navigate,
      request: this.options.request,
      openDialog: (id) => {
        this.dialogs[id] = true
      },
      closeDialog: (id) => {
        this.dialogs[id] = false
      },
      setNodeProp: (nodeId, prop, value) => this.setNodeProp(nodeId, prop, value),
      setVariable: (name, value) => {
        this.variables[name] = value
      },
      emit: (event, payload) => {
        void this.eventEngine.dispatch(
          event,
          { eventName: event, payload },
          this.createActionContext(),
        )
      },
    }
    return { ...base, ...partial }
  }

  /** 节点属性写入：编辑器走回调；预览模式走响应式 override */
  setNodeProp(nodeId: string, prop: string, value: unknown): void {
    if (this.options.onSetNodeProp) {
      this.options.onSetNodeProp(nodeId, prop, value)
      return
    }
    if (!this.overrides[nodeId]) this.overrides[nodeId] = {}
    this.overrides[nodeId][prop] = value
  }

  /** 求值节点属性（静态 / 表达式 / 本地覆盖） */
  resolveProp(
    node: PageNode,
    propName: string,
    loop?: { itemName: string; indexName?: string; item: unknown; index: number },
  ): unknown {
    const override = this.overrides[node.id]?.[propName]
    if (override !== undefined) return override
    const raw = node.props[propName]
    return this.resolveBinding(raw, loop)
  }

  /** 求值节点可见性（默认可见） */
  resolveVisible(
    node: PageNode,
    loop?: { itemName: string; indexName?: string; item: unknown; index: number },
  ): boolean {
    const binding = node.bindings?.visible
    if (!binding) return true
    if (isExpressionBinding(binding)) {
      const result = this.expression.tryEvaluate<boolean>(
        binding.value,
        this.buildExpressionContext(loop),
      )
      return result.ok ? Boolean(result.value) : true
    }
    return Boolean((binding as Binding<boolean>).value)
  }

  /** 求值循环绑定；无循环返回 null */
  resolveLoop(node: PageNode): LoopResolution | null {
    const binding = node.bindings?.loop
    if (!binding) return null
    let config: unknown
    if (isExpressionBinding(binding)) {
      const result = this.expression.tryEvaluate<LoopConfig>(
        binding.value,
        this.buildExpressionContext(),
      )
      config = result.ok ? result.value : undefined
    } else {
      config = (binding as Binding<LoopConfig>).value
    }
    if (!config || typeof config !== 'object') return null
    const { source, itemName, indexName } = config as LoopConfig
    const result = this.expression.tryEvaluate(source, this.buildExpressionContext())
    const items = result.ok && Array.isArray(result.value) ? result.value : []
    return { items, itemName, indexName }
  }

  /** 求值节点样式（CSS 属性 → 值） */
  resolveStyle(
    node: PageNode,
    loop?: { itemName: string; indexName?: string; item: unknown; index: number },
  ): Record<string, string | number> {
    const style: Record<string, string | number> = {}
    for (const [key, binding] of Object.entries(node.style ?? {})) {
      if (isExpressionBinding(binding)) {
        const result = this.expression.tryEvaluate<string | number>(
          binding.value,
          this.buildExpressionContext(loop),
        )
        if (result.ok && result.value != null) style[key] = result.value
      } else if (binding.value != null) {
        style[key] = binding.value
      }
    }
    return style
  }

  /** 派发节点事件：交给 EventEngine 执行动作链 */
  dispatchNodeEvent(node: PageNode, eventName: string, _payload: unknown): void {
    const actions: EventAction[] = node.events?.[eventName] ?? []
    void this.eventEngine.execute(
      actions,
      this.createActionContext({ nodeId: node.id }),
    )
  }

  private resolveBinding(
    raw: unknown,
    loop?: { itemName: string; indexName?: string; item: unknown; index: number },
  ): unknown {
    if (isExpressionBinding(raw)) {
      const result = this.expression.tryEvaluate(
        raw.value,
        this.buildExpressionContext(loop),
      )
      return result.ok ? result.value : undefined
    }
    if (isStaticBinding(raw)) return raw.value
    return raw
  }
}
