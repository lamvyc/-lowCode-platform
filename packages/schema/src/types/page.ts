import type { DataSource } from './datasource'
import type { Layout } from './layout'
import type { MaterialRef } from './material'
import type { PageNode } from './node'
import type { Rule } from './rule'
import type { PageVariable } from './variable'

/**
 * 页面元信息
 * @deprecated 旧版扁平 PageSchema（1.x）已废弃，迁移到 UnifiedPageSchema（2.x）
 */
export interface PageMeta {
  id: string
  name: string
  description?: string
  route?: string
  createdAt: string
  updatedAt: string
}

/** 路由配置 */
export interface RouteConfig {
  path: string
  name?: string
  meta?: Record<string, unknown>
}

/** 表单尺寸 */
export type FormSize = 'large' | 'default' | 'small'

/** 表单标签位置 */
export type FormLabelPosition = 'left' | 'top'

/** 表单标签对齐方式 */
export type FormLabelAlign = 'left' | 'center' | 'right'

/**
 * 表单/页面级设置：驱动设计器「表单设置」面板，并作为代码生成（SFC）的输入。
 * 全部字段可选，未设置时回落到 DEFAULT_FORM_SETTINGS。
 */
export interface FormSettings {
  /** 表单尺寸 */
  size?: FormSize
  /** 标签位置：左侧 / 顶部 */
  labelPosition?: FormLabelPosition
  /** 标签对齐方式 */
  labelAlign?: FormLabelAlign
  /** 标签宽度（px，labelPosition 为 left 时生效） */
  labelWidth?: number
  /** 自定义 CSS 类名（多选，取自 cssCode 中提取的类名） */
  customClass?: string[]
  /** 表单自定义 CSS 代码 */
  cssCode?: string
  /** 全局函数代码（注入到生成页面的逻辑区） */
  functions?: string
  /** 生成 SFC 时的表单模型变量名 */
  modelName?: string
  /** 生成 SFC 时的表单 ref 名 */
  refName?: string
  /** 生成 SFC 时的校验规则变量名 */
  rulesName?: string
  /** 表单事件：onFormCreated 函数体代码 */
  onFormCreated?: string
  /** 表单事件：onFormMounted 函数体代码 */
  onFormMounted?: string
  /** 表单事件：onFormDataChange 函数体代码 */
  onFormDataChange?: string
}

/** 页面设置 */
export interface PageSettings {
  title?: string
  layout?: Layout
  backgroundColor?: string
  width?: number
  /** 表单级设置（表单设计器「表单设置」面板） */
  form?: FormSettings
}

/**
 * 页面协议：整个低代码平台的数据根（旧版扁平结构）
 * @deprecated 使用 UnifiedPageSchema（统一骨架 version/kind/metadata/spec/migrations，P5）
 * 通过 migrateToUnified 自动迁移。
 */
export interface PageSchema {
  version: string
  meta: PageMeta
  nodes: PageNode[]
  materials: MaterialRef[]
  dataSources: DataSource[]
  variables: PageVariable[]
  rules: Rule[]
  routes?: RouteConfig
  settings?: PageSettings
}

/** 事件调度载荷（Runtime → EventEngine） */
export interface EventDispatchPayload {
  nodeId?: string
  eventName?: string
  payload?: unknown
}
