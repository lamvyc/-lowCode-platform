import type { DataModelSchema, FieldType } from '@lowcode/schema'
import type { FormField, FormSchema } from './types'

/** 字段数据类型 → 默认控件类型（P1 推断，物料层可覆盖） */
const WIDGET_BY_FIELD_TYPE: Record<FieldType, string> = {
  string: 'input',
  number: 'input-number',
  boolean: 'switch',
  date: 'date-picker',
  datetime: 'date-picker',
  enum: 'select',
  json: 'textarea',
  relation: 'select',
}

/**
 * 从数据模型 Schema 派生表单字段（P1「双向生成」的一半）：
 * - fields → FormField（widget 按 dataType 推断，enum 选项来自 validation.enum）
 * - 关联（oneToOne）→ select 字段
 * - oneToMany / manyToMany 由子表承载，不在此派生
 */
export function dataModelToFormSchema(model: DataModelSchema): FormSchema {
  const fields: FormField[] = model.spec.fields.map((field) => ({
    name: field.name,
    label: field.label,
    dataType: field.type,
    widget: WIDGET_BY_FIELD_TYPE[field.type],
    validation: field.validation,
    defaultValue: field.defaultValue,
    options: field.validation?.enum,
  }))

  for (const relation of model.spec.relations ?? []) {
    if (relation.type === 'oneToOne') {
      fields.push({
        name: relation.name,
        label: relation.name,
        dataType: 'relation',
        widget: 'select',
      })
    }
  }

  return { fields }
}
