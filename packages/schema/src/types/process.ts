import type { FieldType } from './datamodel'
import type { SchemaEnvelope } from './schema'

/** 流程节点类型（声明式，P1/P6：不硬编码 UI 逻辑） */
export const PROCESS_NODE_TYPES = [
  'start',
  'end',
  'task',
  'apiCall',
  'dataModel',
  'delay',
  'condition',
] as const

export type ProcessNodeType = (typeof PROCESS_NODE_TYPES)[number]

export const DATA_MODEL_OPERATIONS = ['query', 'create', 'update', 'delete'] as const
export type DataModelOperation = (typeof DATA_MODEL_OPERATIONS)[number]

export interface ProcessNode {
  id: string
  type: ProcessNodeType
  name?: string
  /** condition 节点/边的分支表达式（沙箱，Process 上下文） */
  expression?: string
  /** apiCall 节点引用 ApiSchema metadata.id */
  apiRef?: string
  /** dataModel 节点引用 DataModelSchema metadata.id */
  modelRef?: string
  operation?: DataModelOperation
  /** 入参（值可为表达式字符串） */
  input?: Record<string, unknown>
  /** 结果写入的变量名（$output.xxx） */
  output?: string
  /** delay 节点毫秒数 */
  delayMs?: number
}

export interface ProcessEdge {
  id: string
  from: string
  to: string
  /** 分支条件（沙箱表达式） */
  expression?: string
}

export interface ProcessVariable {
  name: string
  type: FieldType
  defaultValue?: unknown
  description?: string
}

export interface ProcessSpec {
  input?: ProcessVariable[]
  output?: ProcessVariable[]
  variables?: ProcessVariable[]
  nodes: ProcessNode[]
  edges: ProcessEdge[]
}

export interface ProcessSchema extends SchemaEnvelope<'Process', ProcessSpec> {}
