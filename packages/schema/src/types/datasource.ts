/** 数据源类型：REST / 静态 / 本地存储 / 会话存储 / 页面变量 */
export type DataSourceType =
  | 'rest'
  | 'static'
  | 'localStorage'
  | 'sessionStorage'
  | 'pageVariable'

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
