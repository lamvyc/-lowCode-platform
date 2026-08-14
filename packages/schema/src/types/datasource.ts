import type { DataModelOperation } from './process'

/** 数据源类型：REST / 静态 / 本地存储 / 会话存储 / 页面变量 / DataModel / API 引用 */
export type DataSourceType =
  | 'rest'
  | 'static'
  | 'localStorage'
  | 'sessionStorage'
  | 'pageVariable'
  | 'DataModel'
  | 'API'

/** 数据源配置，按 type 解释不同字段 */
export interface DataSourceConfig {
  url?: string
  method?: string
  params?: Record<string, unknown>
  headers?: Record<string, string>
  staticData?: unknown
  storageKey?: string
  variableId?: string
  /** 轮询间隔（毫秒），可选 */
  pollInterval?: number
  /** DataModel 数据源：引用 DataModelSchema metadata.id */
  modelRef?: string
  /** DataModel 数据源操作（query/create/update/delete） */
  operation?: DataModelOperation
  /** DataModel 查询过滤表达式 */
  filter?: string
  /** API 数据源：引用 ApiSchema metadata.id */
  apiRef?: string
}

/** 页面数据源声明 */
export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  config: DataSourceConfig
  autoLoad?: boolean
  enabled?: boolean
}
