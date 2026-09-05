/** 属性面板控件类型 */
export type PropControlType =
  | 'input'
  | 'number'
  | 'select'
  | 'switch'
  | 'color'
  | 'name'
  | 'label'
  | 'hidden'
  | 'style'
  | 'expression'
  | 'event'
  | 'json'
  | 'monaco'
  | 'slots'

/** 下拉选项 */
export interface PropOption {
  label: string
  value: string
}

/** 属性配置：驱动右侧属性面板动态渲染控件 */
export interface PropConfig {
  name: string
  label: string
  control: PropControlType
  options?: PropOption[]
  defaultValue?: unknown
  description?: string
  placeholder?: string
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
