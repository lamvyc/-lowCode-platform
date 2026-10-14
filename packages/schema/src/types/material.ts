/** 属性面板控件类型 */
export type PropControlType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'select'
  | 'switch'
  | 'color'
  | 'radio'
  | 'radio-button'
  | 'checkbox'
  | 'name'
  | 'label'
  | 'hidden'
  | 'style'
  | 'custom-class'
  | 'expression'
  | 'event'
  | 'events'
  | 'option-items'
  | 'structure'
  | 'json'
  | 'code'
  | 'monaco'
  | 'slots'

/** 属性面板分区：通用设置 / 高级设置 / 事件设置（对齐参考实现的折叠分组） */
export type PropGroup = 'common' | 'advanced' | 'event'

/** 下拉选项 */
export interface PropOption {
  label: string
  value: string
}

/** 数字控件的取值范围（仅 number 控件生效） */
export interface PropNumberRange {
  min?: number
  max?: number
  step?: number
}

/**
 * 属性联动条件：依赖的其他属性满足条件时该配置项才展示。
 * 例如「最大长度」仅在「显示字数统计」打开时显示。
 */
export interface PropVisibleWhen {
  /** 依赖的属性名（props 中的 key） */
  prop: string
  /** 等于该值时展示 */
  equals?: unknown
  /** 取值命中数组之一时展示 */
  in?: unknown[]
  /** 不等于该值时展示 */
  notEquals?: unknown
}

/** 属性配置：驱动右侧属性面板动态渲染控件 */
export interface PropConfig {
  name: string
  label: string
  control: PropControlType
  /** 归属分区，缺省按控件类型推断（common/advanced/event） */
  group?: PropGroup
  /** 专用编辑器标识，覆盖 control 的默认渲染（如 'optionItems'） */
  editor?: string
  options?: PropOption[]
  defaultValue?: unknown
  description?: string
  placeholder?: string
  /** 数字控件范围 */
  range?: PropNumberRange
  /** 联动展示条件 */
  visibleWhen?: PropVisibleWhen
  /** 只读展示（不参与编辑） */
  readonly?: boolean
}

/** 组件事件声明：驱动「事件设置」分区与事件编辑器对话框 */
export interface MaterialEventConfig {
  /** 事件名（写入 node.events 的 key，同时也是运行时 DOM 事件名） */
  name: string
  /** 展示名，缺省等于 name */
  label?: string
  /** 事件回调参数名列表（仅用于对话框头部提示） */
  params?: string[]
  /** 说明文案 */
  description?: string
}

/**
 * 物料默认子节点声明：插入容器物料时自动创建内部结构节点。
 * 例如栅格插入时自动带 1 个栅格列，标签页插入时自动带 2 个标签页。
 */
export interface MaterialDefaultChild {
  type: string
  /** 创建个数，默认 1 */
  count?: number
  /** 落入的插槽，默认 default */
  slot?: string
  /** 递归子结构 */
  children?: MaterialDefaultChild[]
}

/** JSON Schema 格式的属性面板定义（P4 推荐） */
export interface PropertySchema {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

/** 远程物料元信息（扩展能力，暂不参与默认注册） */
export interface RemoteMaterialMeta {
  url: string
  format: 'esm' | 'umd'
  version: string
  dependencies?: Record<string, string>
  cache?: boolean
}

/** 远程物料清单：声明如何加载并注册一个远程物料 */
export interface RemoteMaterialManifest extends RemoteMaterialMeta {
  type: string
  name: string
  category: string
  icon?: string
  description?: string
  defaultProps: Record<string, unknown>
  /** @deprecated 使用 propertySchema（JSON Schema 格式，P4） */
  propConfigs: PropConfig[]
  /** JSON Schema 属性面板定义 */
  propertySchema?: PropertySchema
  /** 插件接口标识（如 chart-plugin） */
  pluginInterface?: string
  slots?: string[]
  /** 支持的事件声明（驱动「事件设置」分区） */
  events?: MaterialEventConfig[]
  /** 内部物料：组件库面板不展示 */
  hidden?: boolean
  /** 插入时自动创建的内部结构节点 */
  defaultChildren?: MaterialDefaultChild[]
  droppable?: boolean
  groupable?: boolean
  /** UMD 导出到 window 上的全局名 */
  umdGlobalName?: string
}

/** 物料声明：组件 + 默认属性 + 属性配置 + 插槽 */
export interface Material {
  type: string
  name: string
  category: string
  icon?: string
  description?: string
  version: string
  defaultProps: Record<string, unknown>
  /** @deprecated 使用 propertySchema（JSON Schema 格式，P4） */
  propConfigs: PropConfig[]
  /** JSON Schema 属性面板定义（驱动右侧属性面板动态渲染） */
  propertySchema?: PropertySchema
  /** 插件接口标识（如 chart-plugin） */
  pluginInterface?: string
  /** 支持的具名插槽 */
  slots?: string[]
  /** 支持的事件声明（驱动「事件设置」分区） */
  events?: MaterialEventConfig[]
  /** 内部物料：注册表可见但组件库面板不展示（如栅格列 / 表格行 / 单元格 / 标签页） */
  hidden?: boolean
  /** 插入时自动创建的内部结构节点 */
  defaultChildren?: MaterialDefaultChild[]
  /** 是否可作为容器接收子节点 */
  droppable?: boolean
  /** 是否支持被拖动（编辑器拖拽移动） */
  groupable?: boolean
  /** @deprecated 组件实现不应写入 Schema（P4），运行时由 MaterialRegistry 注入 */
  component?: unknown
  remote?: RemoteMaterialMeta
}

/** 页面声明的物料引用 */
export interface MaterialRef {
  type: string
  version?: string
}
