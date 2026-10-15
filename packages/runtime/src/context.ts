import { reactive, type InjectionKey, type ShallowRef } from 'vue'
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
import { runRequiredValidator, runValidation } from '@lowcode/core'
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
import { createFieldHandle, type FieldHandle } from './field'
import { ErrorCollector, type RuntimeError } from './errors'
import { EngineMetrics } from './metrics'

/**
 * RuntimeRenderer provide 的运行时上下文 key（物料组件通过它读取弹窗等状态）。
 *
 * 值是 **ref**：编辑器每次 schema 变更都会重建 `RuntimeContext`（见 `EditorEngine.record`），
 * 而 `provide` 只在 `setup` 里执行一次，直接 provide 对象会让下游一直拿到旧上下文。
 */
export const RUNTIME_CONTEXT_KEY: InjectionKey<ShallowRef<RuntimeContext>> =
  Symbol('lc.runtimeContext')

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

/** 校验触发时机 */
export type FieldTrigger = 'blur' | 'change'

/**
 * 一条字段校验规则。
 *
 * `trigger` 与参考实现一致：必填只有 `blur`，格式校验与自定义校验是 `blur` + `change`。
 *
 * ⚠️ 但要注意**参考实现里这个区分在净效果上不起作用**：
 * 它的 `handleChangeEvent` 会在同步完值之后显式调用 `el-form.validateField`，
 * 而 Element UI 的 `validateField` 传空 trigger → 不过滤规则 → **所有规则都会跑**。
 * 加上每条规则都包含 `blur`，所以 blur 时同样全跑。
 * 那个 `trigger: ['blur']` 是为了绕开 Element **内部控制**在 change 时"值尚未同步"就先校验的竞态；
 * 本架构的校验挂在组件自身 emit 的 blur/change 上（`update:modelValue` 已先落地），不存在该竞态。
 *
 * 这里保留 `trigger` 是为了忠实表达契约并可独立测试，调用方默认传空（跑全部规则）。
 */
export interface FieldRule {
  trigger: FieldTrigger[]
  /** 返回错误文案；通过时返回 undefined */
  validate(value: unknown): string | undefined
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
  /** 字段校验错误：nodeId → 错误文案（响应式，驱动 FormItem 展示） */
  readonly fieldErrors: Record<string, string | undefined> = reactive({})

  /** 运行时局部状态（动作读写） */
  readonly state: Record<string, unknown> = reactive({})
  /** 表单注册表：formId → FormEngine（submit 动作默认从这取表单） */
  readonly forms = new Map<string, FormEngine>()
  /** 构造选项（保留引用以便扩展） */
  readonly options: RuntimeContextOptions
  /** 节点索引：nodeId → PageNode，把渲染查找从 O(n) 降到 O(1) */
  readonly nodeMap = new Map<string, PageNode>()
  /** 字段名索引：node.name → nodeId（参考实现用名称寻址组件，这里做 O(1) 反查） */
  readonly nameIndex = new Map<string, string>()
  /** 错误收集器：单组件/表达式/数据源出错不阻断整体 */
  readonly errors = new ErrorCollector()
  /** 引擎执行指标：render / datasource / rules / event */
  readonly metrics = new EngineMetrics()

  constructor(options: RuntimeContextOptions) {
    this.options = options
    this.schema = normalizePageSchema(options.schema)
    for (const node of this.schema.nodes) {
      this.nodeMap.set(node.id, node)
      // 重名时后者覆盖前者——与参考实现 refList 的行为一致（无告警）
      if (node.name) this.nameIndex.set(node.name, node.id)
    }
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

  /**
   * 名称（或 id）→ 节点 id。
   *
   * 先按字段名查，未命中再把入参当节点 id 校验——与 `PageNode.name` 的约定一致
   * （"唯一名称（编辑器身份标识；缺省时回退到 id）"）。
   */
  resolveNodeId(nameOrId: string): string | undefined {
    const byName = this.nameIndex.get(nameOrId)
    if (byName) return byName
    return this.nodeMap.has(nameOrId) ? nameOrId : undefined
  }

  /**
   * 按名称（或 id）取字段句柄，对应参考实现的 `getWidgetRef(widgetName)`。
   *
   * 返回的是**句柄对象**而非 Vue 组件实例：本架构里字段的读写都是节点级操作
   * （值走运行时存储、配置走属性写入），不需要也不应该依赖实例。
   * 能力面见 `FieldHandle`。
   */
  getWidgetRef(nameOrId: string): FieldHandle | undefined {
    const nodeId = this.resolveNodeId(nameOrId)
    return nodeId ? createFieldHandle(this, nodeId) : undefined
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
    const bucket = this.overrides[nodeId]
    if (!bucket) {
      // 一次性写入：分两步（建桶 + 赋值）会触发两次响应式更新，导致整树重渲染两次
      this.overrides[nodeId] = { [prop]: value }
      return
    }
    bucket[prop] = value
  }

  /**
   * 字段值写回（`v-model` 的落点）。
   *
   * 与 `setNodeProp` **有意区分**：
   * - `setNodeProp` 表示"组件要改自己的某个 prop"，在编辑器里应当**走 schema 历史**；
   * - 字段值（`modelValue`）是**运行期的活值**，任何时候都**不能**写回 schema——
   *   否则用户在画布/表单里敲进去的内容会变成"默认值"，还会污染撤销历史。
   *
   * 这也是参考实现把 `syncUpdateFormModel`（写数据源）与 `setWidgetOption`（写配置）
   * 分成两条路径的同一考量。
   *
   * 当前实现写入响应式 `overrides`，由 `resolveProp` 优先读取，从而驱动重渲染。
   * 说明：设计器里每次 schema 变更都会重建 RuntimeContext（见 `EditorEngine.record`），
   * 因此覆盖值会随之清空、schema 的新"默认值"重新生效——正是参考实现
   * `refreshDefaultValue()` 的效果。
   *
   * 后续接入 FormEngine 时，此方法体替换为 `engine.setValue(fieldName, value)` 即可，
   * 调用方（渲染器）无需改动。
   */
  setNodeValue(nodeId: string, value: unknown): void {
    const bucket = this.overrides[nodeId]
    if (!bucket) {
      // 同 setNodeProp：必须一次写入，否则首个字符会触发两次整树重渲染
      this.overrides[nodeId] = { modelValue: value }
      return
    }
    bucket.modelValue = value
  }

  /** 读取节点当前字段值（含覆盖）；未声明 modelValue 的节点返回 undefined */
  getNodeValue(nodeId: string): unknown {
    const node = this.getNode(nodeId)
    if (!node) return undefined
    return this.resolveProp(node, 'modelValue')
  }

  /**
   * 清空字段值覆盖，使值回落到 schema 中的默认值（对应参考实现的 `resetField`）。
   *
   * 注意这里是**删除覆盖**而不是写 `undefined`：`resolveProp` 用 `!== undefined` 判断覆盖是否存在，
   * 写 `undefined` 等价于没写。
   */
  resetNodeValue(nodeId: string): void {
    const bucket = this.overrides[nodeId]
    if (!bucket) return
    delete bucket.modelValue
  }

  /**
   * 节点隐藏开关。
   *
   * `hidden` 在本架构里是**节点级系统属性**（`node.meta.hidden`），不是组件 prop
   * （见 `materials/src/manifest.ts` 的 `systemProps` 与设计器 `PropField.vue` 的 hidden 分支），
   * 因此不能走 `setNodeProp`。写入覆盖，由 `resolveHidden` 统一求值。
   *
   * ⚠️ 与 `setNodeProp` 不同，这里**不做编辑器分发**：设计器改隐藏走的是它自己的
   * `updateNode`→`meta.hidden` 路径；且每次 schema 变更都会重建 context，覆盖值随之清空。
   */
  setNodeHidden(nodeId: string, hidden: boolean): void {
    const bucket = this.overrides[nodeId]
    if (!bucket) {
      // 同 setNodeValue：一次写入，避免两次响应式更新
      this.overrides[nodeId] = { hidden }
      return
    }
    bucket.hidden = hidden
  }

  /** 求值节点是否隐藏：覆盖优先，其次 schema 的 `meta.hidden` */
  resolveHidden(node: PageNode): boolean {
    const override = this.overrides[node.id]?.hidden
    if (override !== undefined) return Boolean(override)
    return Boolean(node.meta?.hidden)
  }

  // ------------------------------------------------------------------
  // 字段校验
  // 语义照 00-通用字段行为规范.md 第四章；规则来源是**节点自身**（不是独立的 FormSchema）。
  // 错误按 **nodeId** 存（参考实现按字段名存，但本架构允许 name 为空或重名，nodeId 更可靠）。
  // ------------------------------------------------------------------

  /** 取节点的文本型 prop；空串 / null / undefined 一律归一为 undefined */
  private textProp(node: PageNode, name: string): string | undefined {
    const value = this.resolveProp(node, name)
    if (value === undefined || value === null || value === '') return undefined
    return String(value)
  }

  /**
   * 从节点 props 推导校验规则。
   *
   * 隐藏字段不产生规则——参考实现 `setHidden(true)` 会显式清空规则，这里统一成"隐藏即不校验"，
   * 消掉参考实现"初始就 hidden 的字段仍带着规则"的不一致。
   *
   * ⚠️ 参考实现里的 `onValidate`（`new Function` 执行用户代码）在本仓库的物料清单中**没有声明**，
   * 因此这里不实现；若将来要支持，应先决策沙箱/CSP 方案（见 00-通用字段行为规范.md 第十二章）。
   */
  buildFieldRules(node: PageNode): FieldRule[] {
    if (this.resolveHidden(node)) return []

    const label = this.textProp(node, 'label') ?? node.name ?? node.id
    const rules: FieldRule[] = []

    if (this.resolveProp(node, 'required')) {
      const errorMsg = this.textProp(node, 'requiredHint')
      rules.push({
        trigger: ['blur'],
        validate: (value) => runRequiredValidator(value, { label, errorMsg }),
      })
    }

    const validation = this.textProp(node, 'validation')
    if (validation) {
      const errorMsg = this.textProp(node, 'validationHint')
      rules.push({
        trigger: ['blur', 'change'],
        validate: (value) => runValidation(validation, value, { label, errorMsg }),
      })
    }

    return rules
  }

  /**
   * 校验单个字段并把结果记入 `fieldErrors`。
   *
   * `trigger` 为空表示不过滤规则（跑全部）——这是参考实现 `handleChangeEvent` 之后
   * 显式调用 `validateField` 的语义，用于**清除已经过期的必填错误**。
   */
  validateField(nodeId: string, trigger?: FieldTrigger): string | undefined {
    const node = this.getNode(nodeId)
    if (!node) return undefined
    const rules = this.buildFieldRules(node).filter(
      (rule) => !trigger || rule.trigger.includes(trigger),
    )
    const value = this.getNodeValue(nodeId)
    let message: string | undefined
    for (const rule of rules) {
      message = rule.validate(value)
      if (message) break
    }
    this.setFieldError(nodeId, message)
    return message
  }

  /** 校验所有含 `modelValue` 的可见字段；返回是否全部通过 */
  validateAll(trigger?: FieldTrigger): boolean {
    let ok = true
    for (const node of this.schema.nodes) {
      if (!('modelValue' in node.props)) continue
      if (this.resolveHidden(node)) continue
      if (this.validateField(node.id, trigger)) ok = false
    }
    return ok
  }

  getFieldError(nodeId: string): string | undefined {
    return this.fieldErrors[nodeId]
  }

  setFieldError(nodeId: string, message: string | undefined): void {
    if (message === undefined) {
      if (nodeId in this.fieldErrors) delete this.fieldErrors[nodeId]
      return
    }
    this.fieldErrors[nodeId] = message
  }

  /** 清空全部校验错误（对应参考实现的 `clearValidate`） */
  clearFieldErrors(): void {
    for (const key of Object.keys(this.fieldErrors)) delete this.fieldErrors[key]
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
