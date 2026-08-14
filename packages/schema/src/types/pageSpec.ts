import type { UnifiedEventAction } from './action'
import type { MaterialRef } from './material'
import type { PageNode } from './node'
import type { PageSettings } from './page'
import type { PageVariable } from './variable'
import type { SchemaEnvelope } from './schema'

/** 数据源操作类型（P6：Page 通过 dataSource 引用外部 DataModel/API） */
export const DATA_SOURCE_OPERATIONS = ['query', 'create', 'update', 'delete'] as const
export type DataSourceOperation = (typeof DATA_SOURCE_OPERATIONS)[number]

export const INTERACTION_TRIGGERS = ['expression', 'event', 'datasource', 'mount'] as const
export type InteractionTrigger = (typeof INTERACTION_TRIGGERS)[number]

/**
 * 统一数据源：声明式引用外部资源（P6）
 * 禁止在 Page 内联数据结构定义。
 */
export type UnifiedDataSource =
  | {
      id: string
      name?: string
      type: 'DataModel'
      /** 引用 DataModelSchema metadata.id */
      ref: string
      operation: DataSourceOperation
      /** 动态过滤条件（沙箱表达式，Page 上下文） */
      filter?: string
    }
  | {
      id: string
      name?: string
      type: 'API'
      /** 引用 ApiSchema metadata.id */
      ref: string
      params?: Record<string, unknown>
      pollInterval?: number
    }
  | {
      id: string
      name?: string
      type: 'static' | 'localStorage' | 'sessionStorage' | 'pageVariable'
      value?: unknown
      storageKey?: string
      variableId?: string
    }

/** 统一页面节点：事件使用标准 Action（P1） */
export type UnifiedPageNode = Omit<PageNode, 'events'> & {
  events?: Record<string, UnifiedEventAction[]>
}

/** 声明式交互：条件命中后执行动作链（替代旧版 actions/rules，P5 迁移） */
export interface UnifiedInteraction {
  id: string
  name?: string
  enabled?: boolean
  trigger?: InteractionTrigger
  /** 条件表达式（沙箱，Page 上下文） */
  expression: string
  actions: UnifiedEventAction[]
  debounceMs?: number
  dependsOn?: string[]
}

export interface PageSpec {
  route?: string
  nodes: UnifiedPageNode[]
  materials?: MaterialRef[]
  dataSources?: UnifiedDataSource[]
  variables?: PageVariable[]
  interactions?: UnifiedInteraction[]
  settings?: PageSettings
}

export interface UnifiedPageSchema extends SchemaEnvelope<'Page', PageSpec> {}
