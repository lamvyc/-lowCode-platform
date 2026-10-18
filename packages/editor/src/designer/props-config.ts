import {
  isExpressionBinding,
  isStaticBinding,
  type ActionKind,
  type EventAction,
  type Material,
  type PageNode,
  type PropConfig,
  type PropGroup,
  type PropertySchema,
  type StyleConfig,
} from '@lowcode/schema'

/** 属性分区展示信息（顺序即面板折叠区顺序） */
export const PROP_GROUPS: ReadonlyArray<{ key: PropGroup; label: string; hint?: string }> = [
  { key: 'common', label: '通用设置' },
  { key: 'advanced', label: '高级设置', hint: '样式、尺寸与行为细节' },
  { key: 'event', label: '事件设置', hint: '为组件绑定交互动作链' },
]

/** 推断属性归属分区：显式 group 优先，其次按控件类型推断 */
export function resolvePropGroup(config: PropConfig): PropGroup {
  if (config.group) return config.group
  if (config.control === 'event' || config.control === 'events') return 'event'
  return 'common'
}

/**
 * JSON Schema 属性面板定义 → PropConfig 兜底转换（P4）：
 * 仅当物料未声明 propConfigs 时才使用，支持 type/enum/title/description/default
 * 以及 x-control / x-group / x-placeholder 扩展字段。
 */
export function propertySchemaToPropsConfigs(schema?: PropertySchema): PropConfig[] {
  const properties = schema?.properties
  if (!properties || typeof properties !== 'object') return []
  const configs: PropConfig[] = []
  for (const [name, raw] of Object.entries(properties as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const definition = raw as Record<string, unknown>
    const type = definition.type
    const enumValues = Array.isArray(definition.enum) ? definition.enum : undefined
    const control =
      typeof definition['x-control'] === 'string'
        ? (definition['x-control'] as PropConfig['control'])
        : type === 'boolean'
          ? 'switch'
          : type === 'number' || type === 'integer'
            ? 'number'
            : enumValues
              ? 'select'
              : 'input'
    const group = definition['x-group']
    configs.push({
      name,
      label: typeof definition.title === 'string' ? definition.title : name,
      control,
      group: group === 'advanced' || group === 'event' ? group : 'common',
      options: enumValues?.map((value) => ({ label: String(value), value: String(value) })),
      defaultValue: definition.default,
      description: typeof definition.description === 'string' ? definition.description : undefined,
      placeholder:
        typeof definition['x-placeholder'] === 'string' ? definition['x-placeholder'] : undefined,
    })
  }
  return configs
}

/** 物料属性配置：优先 propConfigs，缺省回落到 propertySchema（P4） */
export function materialPropConfigs(material?: Material): PropConfig[] {
  if (!material) return []
  if (material.propConfigs.length > 0) return material.propConfigs
  return propertySchemaToPropsConfigs(material.propertySchema)
}

/** 按分区聚合属性配置，空分区不返回 */
export function groupPropConfigs(
  configs: PropConfig[],
): Array<{ key: PropGroup; label: string; hint?: string; configs: PropConfig[] }> {
  return PROP_GROUPS.map((group) => ({
    ...group,
    configs: configs.filter((config) => resolvePropGroup(config) === group.key),
  })).filter((group) => group.configs.length > 0)
}

/**
 * 属性联动条件求值：判断配置项在当前节点上是否可见。
 * 依赖属性的取值缺失时回落到其声明的 defaultValue（与面板展示保持一致）。
 *
 * `device` 是设计器当前设备档位（pc / pad / h5）。配置声明了 `visibleWhen.device`
 * 时只有匹配的档位才展示；调用方不传 device 则视为不限制（兼容旧调用）。
 */
export function isPropVisible(
  config: PropConfig,
  node: PageNode,
  configs?: PropConfig[],
  device?: string,
): boolean {
  const when = config.visibleWhen
  if (!when) return true
  if (when.device?.length && device && !when.device.includes(device as 'pc' | 'pad' | 'h5')) {
    return false
  }
  const raw = node.props[when.prop]
  const dependency = configs?.find((item) => item.name === when.prop)
  const value = raw === undefined ? dependency?.defaultValue : raw
  if (when.in) return when.in.includes(value)
  if ('equals' in when) return value === when.equals
  if ('notEquals' in when) return value !== when.notEquals
  return true
}

/** 读取属性当前值（缺省回落到物料声明的 defaultValue） */
export function readPropValue(node: PageNode, config: PropConfig): unknown {
  const value = node.props[config.name]
  return value === undefined ? config.defaultValue : value
}

/** 把节点样式展开成「CSS 属性 → 普通值」（静态绑定解包，表达式绑定原样保留） */
export function toPlainStyle(style?: StyleConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, binding] of Object.entries(style ?? {})) {
    if (isStaticBinding(binding)) result[key] = binding.value
    else if (isExpressionBinding(binding)) result[key] = binding
  }
  return result
}

/**
 * 把面板里的普通 CSS 键值对转换成 StyleConfig。
 * 普通值自动包装为静态绑定——运行时只识别 Binding，直接写裸值不会生效。
 */
export function toStyleConfig(input: Record<string, unknown>): StyleConfig {
  const style: StyleConfig = {}
  for (const [key, value] of Object.entries(input)) {
    if (isStaticBinding(value) || isExpressionBinding(value)) {
      style[key] = value as StyleConfig[string]
    } else if (typeof value === 'string' || typeof value === 'number') {
      style[key] = { type: 'static', value }
    } else {
      throw new Error(`样式 ${key} 的值必须是字符串或数字`)
    }
  }
  return style
}

/** 动作链编辑器可选动作类型（值取自旧版 ActionKind，运行时按别名解析） */
export const ACTION_KIND_OPTIONS: ReadonlyArray<{ label: string; value: ActionKind }> = [
  { label: '更新组件属性', value: 'setProp' },
  { label: '更新页面变量', value: 'setVariable' },
  { label: '打开弹窗', value: 'openDialog' },
  { label: '关闭弹窗', value: 'closeDialog' },
  { label: '派发自定义事件', value: 'emitEvent' },
  { label: '请求数据', value: 'request' },
  { label: '页面跳转', value: 'navigate' },
  // submit / refresh 在 ActionRegistry 里早已实现，但此前既不在 ActionKind 里、
  // 也不在这个列表里 —— 用户**根本加不出**"提交表单"和"刷新数据源"。
  { label: '提交表单', value: 'submit' },
  { label: '刷新数据源', value: 'refresh' },
  { label: '自定义动作', value: 'custom' },
]

/** 动作 config 编辑提示（按动作类型） */
export const ACTION_CONFIG_HINTS: Record<ActionKind, string> = {
  setProp: '{"prop":"text","value":"新文案"}',
  setVariable: '{"name":"count","value":1}',
  openDialog: '{"dialogId":"dialog1"}',
  closeDialog: '{"dialogId":"dialog1"}',
  emitEvent: '{"event":"refresh","payload":{}}',
  request: '{"url":"/api/list","method":"GET"}',
  navigate: '{"route":"/detail"}',
  submit: '{"formId":"page"}',
  refresh: '{"dataSourceId":"ds1"}',
  custom: '{"actionId":"myAction"}',
}

/** 生成动作 id（动作链内唯一） */
export function createActionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** 创建默认动作 */
export function createAction(kind: ActionKind = 'setProp'): EventAction {
  // ⚠️ `submit` 必须带 formId：内置实现里没有 formId 就直接返回
  //    `{ok:false, error:'缺少 formId'}`。页面级表单的 formId 固定是 `page`
  //    （见 runtime 的 PAGE_FORM_ID），所以这里给个好默认值，
  //    否则用户加一个"提交表单"动作会**立刻失败**。
  const config: Record<string, unknown> = kind === 'submit' ? { formId: 'page' } : {}
  return { id: createActionId(), kind, config }
}
