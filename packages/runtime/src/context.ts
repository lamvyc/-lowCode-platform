import { reactive, type InjectionKey } from 'vue'
import {
  ActionRegistry,
  DataSourceManager,
  EventEngine,
  JexlExpressionEngine,
  MemoryStorage,
  RuleEngine,
  type ActionContext,
  type EventAction,
  type ExpressionContext,
  type FormEngine,
  type HttpClient,
  type IEventEngine,
  type IExpressionEngine,
  type SchemaRefResolver,
  type StorageLike,
} from '@lowcode/core'
import {
  isExpressionBinding,
  isStaticBinding,
  normalizePageSchema,
  type Binding,
  type AnyPageSchema,
  type LoopConfig,
  type PageNode,
  type PageSchema,
  type Rule,
} from '@lowcode/schema'
import type { IComponentResolver } from './resolver'
import { ErrorCollector, type RuntimeError } from './errors'
import { EngineMetrics } from './metrics'

/** RuntimeRenderer provide 的运行时上下文 key（物料组件通过它读取弹窗等状态） */
export const RUNTIME_CONTEXT_KEY: InjectionKey<RuntimeContext> = Symbol('lc.runtimeContext')

/** 规则执行重入深度（模块级，避免类私有成员破坏 Ref 解包后的结构类型） */
const ruleRunDepths = new WeakMap<RuntimeContext, number>()

/** 求值带错误收集的绑定表达式（render 热路径） */
function evaluateBinding(
  ctx: RuntimeContext,
  expression: string,
  key: string,
  nodeId?: string,
  loop?: { itemName: string; indexName?: string; item: unknown; index: number },
): unknown {
  const result = ctx.expression.tryEvaluate(expression, ctx.buildExpressionContext(loop))
  if (!result.ok) {
    ctx.errors.add(
      { scope: 'expression', message: result.error, ref: key, nodeId },
      `expression:${key}`,
    )
    return undefined
  }
  ctx.errors.resolve(`expression:${key}`)
  return result.value
}

/** 记录节点级表达式错误（按 节点+引用 去重） */
function recordExpressionError(
  ctx: RuntimeContext,
  nodeId: string,
  ref: string,
  message: string,
): void {
  ctx.errors.add(
    { scope: 'expression', message, nodeId, ref },
    `expression:${nodeId}:${ref}`,
  )
}

export interface RuntimeContextOptions {
  schema: AnyPageSchema
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
  /** DataModel/API 数据源的引用解析器 */
  schemaResolver?: SchemaRefResolver
  /** 表单提交能力（submit 动作依赖，由表单引擎提供） */
  submitForm?: ActionContext['submitForm']
  /** 运行时错误回调（ErrorBoundary / 监控上报入口） */
  onError?: (error: RuntimeError) => void
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
  readonly ruleEngine: RuleEngine
  readonly variables: Record<string, unknown> = reactive({})
  readonly dialogs: Record<string, boolean> = reactive({})
  /** 属性覆盖（预览模式下的本地状态，可响应式驱动 UI） */
  readonly overrides: Record<string, Record<string, unknown>> = reactive({})

  /** 运行时局部状态（动作读写） */
  readonly state: Record<string, unknown> = reactive({})
  /** 表单注册表：formId → FormEngine（submit 动作默认从这取表单） */
  readonly forms = new Map<string, FormEngine>()
  /** 构造选项（保留引用以便扩展） */
  readonly options: RuntimeContextOptions
  /** 节点索引：nodeId → PageNode，把渲染查找从 O(n) 降到 O(1) */
  readonly nodeMap = new Map<string, PageNode>()
  /** 错误收集器：单组件/表达式/数据源出错不阻断整体 */
  readonly errors = new ErrorCollector()
  /** 引擎执行指标：render / datasource / rules / event */
  readonly metrics = new EngineMetrics()

  constructor(options: RuntimeContextOptions) {
    this.options = options
    this.schema = normalizePageSchema(options.schema)
    for (const node of this.schema.nodes) this.nodeMap.set(node.id, node)
    this.resolver = options.resolver
    this.expression = options.expression ?? new JexlExpressionEngine()
    if (options.onError) this.errors.onError = options.onError
    this.datasource = new DataSourceManager({
      http: options.http,
      storage: options.storage ?? new MemoryStorage(),
      // pageVariable 数据源读取实时变量，而非构造时的快照
      getVariables: () => this.variables,
      schemaResolver: options.schemaResolver,
      onLoadError: (id, error) => {
        this.errors.add(
          {
            scope: 'datasource',
            message: error instanceof Error ? error.message : String(error),
            ref: id,
          },
          `datasource:${id}`,
        )
      },
    })
    for (const source of this.schema.dataSources) {
      this.datasource.register(source)
    }
    for (const variable of this.schema.variables) {
      this.variables[variable.name] = variable.value
    }
    this.eventEngine = new EventEngine({ registry: options.actionRegistry })
    this.ruleEngine = new RuleEngine({
      expression: this.expression,
      actionRegistry: options.actionRegistry,
      timing: (name, ms) => this.metrics.record(name, ms),
    })
    // 数据源状态变化 → 触发 datasource / expression 规则（失败隔离 + 重入保护）
    this.datasource.onStateChange(() => {
      void this.runRules('datasource')
      void this.runRules('expression')
    })
  }

  /** 初始化：加载数据源、执行挂载规则 */
  async init(): Promise<void> {
    await this.datasource.loadAll()
    await this.runRules('mount')
    await this.runRules('expression')
  }

  /** O(1) 查找节点（渲染热点路径） */
  getNode(nodeId: string): PageNode | undefined {
    return this.nodeMap.get(nodeId)
  }

  /** 注册表单，返回取消注册函数（submit 动作按 formId 查找并提交） */
  registerForm(formId: string, engine: FormEngine): () => void {
    if (this.forms.has(formId)) throw new Error(`表单已注册: ${formId}`)
    this.forms.set(formId, engine)
    return () => {
      this.forms.delete(formId)
    }
  }

  /** 执行指定触发类型的规则（重入保护，规则动作再触发规则时安全跳过） */
  async runRules(trigger: Rule['trigger']): Promise<void> {
    const depth = ruleRunDepths.get(this) ?? 0
    if (depth > 0) return
    const rules = this.schema.rules.filter((rule) => rule.enabled && rule.trigger === trigger)
    if (rules.length === 0) return
    ruleRunDepths.set(this, depth + 1)
    try {
      await this.ruleEngine.run(
        rules,
        this.buildExpressionContext(),
        this.createActionContext(),
      )
    } catch (error) {
      this.errors.add({
        scope: 'rule',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      ruleRunDepths.set(this, depth)
    }
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
      state: this.state,
      api: this.datasource.getAllData(),
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
      submitForm:
        this.options.submitForm ??
        ((formId) => {
          const form = this.forms.get(formId)
          if (!form) return Promise.resolve({ ok: false, error: `表单未注册: ${formId}` })
          return form.submit().then((ok) =>
            ok ? { ok: true } : { ok: false, error: '表单校验未通过' },
          )
        }),
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
    if (isExpressionBinding(raw)) {
      return evaluateBinding(this, raw.value, `prop:${node.id}:${propName}`, node.id, loop)
    }
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
      if (!result.ok) recordExpressionError(this, node.id, 'visible', result.error)
      else this.errors.resolve(`expression:${node.id}:visible`)
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
      if (!result.ok) recordExpressionError(this, node.id, 'loop', result.error)
      else this.errors.resolve(`expression:${node.id}:loop`)
      config = result.ok ? result.value : undefined
    } else {
      config = (binding as Binding<LoopConfig>).value
    }
    if (!config || typeof config !== 'object') return null
    const { source, itemName, indexName } = config as LoopConfig
    const result = this.expression.tryEvaluate(source, this.buildExpressionContext())
    if (!result.ok) recordExpressionError(this, node.id, 'loop.source', result.error)
    else this.errors.resolve(`expression:${node.id}:loop.source`)
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
        if (!result.ok) recordExpressionError(this, node.id, `style.${key}`, result.error)
        else this.errors.resolve(`expression:${node.id}:style.${key}`)
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
    const expressionContext = this.buildExpressionContext()
    expressionContext.local = { ...(expressionContext.local ?? {}), event: _payload }
    const end = this.metrics.start('event.execute')
    void this.eventEngine
      .execute(actions, this.createActionContext({ nodeId: node.id, expressionContext }))
      .catch((error) => {
        this.errors.add(
          {
            scope: 'event',
            message: error instanceof Error ? error.message : String(error),
            nodeId: node.id,
            ref: eventName,
          },
          `event:${node.id}:${eventName}`,
        )
      })
      .finally(() => {
        end()
        // 事件后顺带刷新声明式规则（event / expression 触发）
        void this.runRules('event')
        void this.runRules('expression')
      })
  }

  /** 求值绑定：静态值 / 表达式 / 原始值 */
  resolveBinding(
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
