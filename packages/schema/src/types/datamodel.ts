import type { SchemaEnvelope } from './schema'

/** 字段类型 */
export const FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'enum',
  'json',
  'relation',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** 关联类型：自动映射为 UI 组件（下拉/子表/穿梭框，P2） */
export const RELATION_TYPES = ['oneToOne', 'oneToMany', 'manyToMany'] as const
export type RelationType = (typeof RELATION_TYPES)[number]

/** 表级权限 */
export const TABLE_PERMISSION_ACTIONS = ['full', 'readonly', 'none'] as const
/** 字段级权限 */
export const FIELD_PERMISSION_ACTIONS = ['readonly', 'hidden', 'editable'] as const
/** 操作级权限 */
export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const
export type CrudAction = (typeof CRUD_ACTIONS)[number]

/** 字段校验：由数据模型统一驱动，页面层不重复定义（P2） */
export interface FieldValidation {
  required?: boolean
  min?: number
  max?: number
  pattern?: string
  minLength?: number
  maxLength?: number
  enum?: Array<string | number | boolean>
  /** 自定义校验表达式（沙箱，DataModel 上下文: $record / $context / $user） */
  custom?: string
}

export interface DataModelField {
  name: string
  type: FieldType
  label?: string
  description?: string
  unique?: boolean
  defaultValue?: unknown
  validation?: FieldValidation
  /** 计算字段表达式（沙箱） */
  expression?: string
}

export interface DataModelRelation {
  name: string
  type: RelationType
  /** 目标数据模型 metadata.id */
  ref: string
  foreignKey?: string
  /** manyToMany 中间模型 */
  through?: string
  cascade?: 'none' | 'restrict' | 'cascade' | 'setNull'
}

export interface TablePermission {
  role: string
  action: (typeof TABLE_PERMISSION_ACTIONS)[number]
}

export interface FieldPermission {
  fieldName: string
  role: string
  action: (typeof FIELD_PERMISSION_ACTIONS)[number]
}

export interface OperationPermission {
  role: string
  actions: CrudAction[]
}

/** 三级权限：表级 / 字段级 / 操作级（P2） */
export interface DataModelPermissions {
  table?: TablePermission[]
  field?: FieldPermission[]
  operation?: OperationPermission[]
}

export interface DataModelSpec {
  primaryKey?: string
  /** 集合/表名 */
  collection?: string
  fields: DataModelField[]
  relations?: DataModelRelation[]
  permissions?: DataModelPermissions
}

export interface DataModelSchema extends SchemaEnvelope<'DataModel', DataModelSpec> {}
