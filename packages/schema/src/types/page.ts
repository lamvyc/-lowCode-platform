import type { DataSource } from './datasource'
import type { Layout } from './layout'
import type { MaterialRef } from './material'
import type { PageNode } from './node'
import type { Rule } from './rule'
import type { PageVariable } from './variable'

/** 页面元信息 */
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

/** 页面设置 */
export interface PageSettings {
  title?: string
  layout?: Layout
  backgroundColor?: string
  width?: number
}

/** 页面协议：整个低代码平台的数据根 */
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
