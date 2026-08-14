import { describe, expect, it } from 'vitest'
import { dataModelToFormSchema } from '@lowcode/core'
import { createDataModelSchema } from '@lowcode/schema'

describe('dataModelToFormSchema 派生表单字段', () => {
  it('按字段类型推断 widget 并携带校验/默认值/枚举选项', () => {
    const model = createDataModelSchema({ id: 'Order', name: '订单' }, {
      collection: 't_order',
      fields: [
        { name: 'orderNo', type: 'string', label: '订单号' },
        { name: 'amount', type: 'number', label: '金额', validation: { min: 0 } },
        {
          name: 'status',
          type: 'enum',
          label: '状态',
          validation: { enum: ['PENDING', 'PAID'] },
        },
        { name: 'paid', type: 'boolean', label: '已支付', defaultValue: false },
      ],
    })

    const form = dataModelToFormSchema(model)
    expect(form.fields.map((f) => f.name)).toEqual(['orderNo', 'amount', 'status', 'paid'])
    expect(form.fields[0]).toMatchObject({ name: 'orderNo', widget: 'input', dataType: 'string' })
    expect(form.fields[1]).toMatchObject({ widget: 'input-number', dataType: 'number' })
    expect(form.fields[2]).toMatchObject({ widget: 'select', options: ['PENDING', 'PAID'] })
    expect(form.fields[3]).toMatchObject({ widget: 'switch', defaultValue: false })
  })

  it('oneToOne 关联派生为 select 字段，oneToMany/manyToMany 由子表承载', () => {
    const model = createDataModelSchema({ id: 'Order', name: '订单' }, {
      fields: [{ name: 'id', type: 'string' }],
      relations: [
        { name: 'detail', type: 'oneToOne', ref: 'OrderDetail' },
        { name: 'items', type: 'oneToMany', ref: 'OrderItem' },
        { name: 'tags', type: 'manyToMany', ref: 'Tag' },
      ],
    })
    const form = dataModelToFormSchema(model)
    expect(form.fields.map((f) => f.name)).toContain('detail')
    expect(form.fields.map((f) => f.name)).not.toContain('items') // oneToMany 由子表承载
    expect(form.fields.map((f) => f.name)).not.toContain('tags') // manyToMany 由子表承载
  })
})
