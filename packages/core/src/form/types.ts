import type { FieldType, FieldValidation } from '@lowcode/schema'

/** 表单字段运行时定义（由 DataModel 派生或手工声明） */
export interface FormField {
  /** 字段名（对应 DataModelField.name，也是值对象的 key） */
  name: string
  /** 展示标签 */
  label?: string
  /** 控件类型（input / input-number / switch / select / date-picker / textarea 等，由物料层映射） */
  widget?: string
  /** 字段数据类型（源自 DataModelField.type，供控件推断展示） */
  dataType?: FieldType
  /** 校验规则（源自 DataModelField.validation） */
  validation?: FieldValidation
  /** 默认值 */
  defaultValue?: unknown
  /** 可见性表达式（沙箱，$form / $record 作用域） */
  visible?: string
  /** 禁用表达式（沙箱） */
  disabled?: string
  /** 选项来源（枚举值或数据源引用，供 select/radio 使用） */
  options?: unknown[]
}

/** 表单定义：字段列表 */
export interface FormSchema {
  fields: FormField[]
}

/** 表单状态机 */
export type FormStatus = 'idle' | 'editing' | 'validating' | 'submitting' | 'submitted'
