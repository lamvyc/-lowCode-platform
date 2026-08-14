import { describe, expect, it, vi } from 'vitest'
import { FormEngine, JexlExpressionEngine } from '@lowcode/core'
import type { FormSchema } from '@lowcode/core'

function makeEngine(schema: FormSchema, onSubmit?: FormEngine['onSubmit']) {
  return new FormEngine({
    schema,
    expression: new JexlExpressionEngine(),
    onSubmit,
  })
}

describe('FormEngine 状态机', () => {
  it('从 defaultValue 初始化值，status 为 idle', () => {
    const engine = makeEngine({
      fields: [
        { name: 'name', defaultValue: '张三' },
        { name: 'age' },
      ],
    })
    expect(engine.getValue('name')).toBe('张三')
    expect(engine.getValue('age')).toBeUndefined()
    expect(engine.status).toBe('idle')
  })

  it('setValue 写入值、标记 dirty、清除该字段错误并通知', () => {
    const onChange = vi.fn()
    const engine = new FormEngine({
      schema: { fields: [{ name: 'name' }] },
      expression: new JexlExpressionEngine(),
      onChange,
    })
    engine.setValue('name', '李四')
    expect(engine.getValue('name')).toBe('李四')
    expect(engine.isDirty('name')).toBe(true)
    expect(engine.isTouched('name')).toBe(false)
    expect(onChange).toHaveBeenCalled()
  })

  it('touch 标记 touched', () => {
    const engine = makeEngine({ fields: [{ name: 'name' }] })
    engine.touch('name')
    expect(engine.isTouched('name')).toBe(true)
  })

  it('reset 恢复默认值并清空状态', () => {
    const engine = makeEngine({ fields: [{ name: 'name', defaultValue: '初始' }] })
    engine.setValue('name', '改了')
    engine.touch('name')
    engine.reset()
    expect(engine.getValue('name')).toBe('初始')
    expect(engine.isDirty('name')).toBe(false)
    expect(engine.isTouched('name')).toBe(false)
    expect(engine.status).toBe('idle')
  })

  it('onChange 订阅多个监听器并支持取消订阅', () => {
    const a = vi.fn()
    const b = vi.fn()
    const engine = makeEngine({ fields: [{ name: 'name' }] })
    const offA = engine.onChange(a)
    engine.onChange(b)
    engine.setValue('name', 'x')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    engine.setValue('name', 'y')
    expect(a).toHaveBeenCalledTimes(1) // 已取消
    expect(b).toHaveBeenCalledTimes(2)
  })
})

describe('FormEngine 字段校验', () => {
  it('required 为空时报错', () => {
    const engine = makeEngine({
      fields: [{ name: 'title', label: '标题', validation: { required: true } }],
    })
    expect(engine.validateField('title')).toContain('必填')
    engine.setValue('title', 'x')
    expect(engine.validateField('title')).toBeUndefined()
  })

  it('number 的 min/max', () => {
    const engine = makeEngine({
      fields: [{ name: 'amount', label: '金额', validation: { min: 0, max: 100 } }],
    })
    engine.setValue('amount', -1)
    expect(engine.validateField('amount')).toContain('不能小于 0')
    engine.setValue('amount', 200)
    expect(engine.validateField('amount')).toContain('不能大于 100')
    engine.setValue('amount', 50)
    expect(engine.validateField('amount')).toBeUndefined()
  })

  it('string 的 minLength/maxLength/pattern', () => {
    const engine = makeEngine({
      fields: [
        {
          name: 'code',
          label: '编码',
          validation: { minLength: 3, maxLength: 5, pattern: '^[A-Z]+$' },
        },
      ],
    })
    engine.setValue('code', 'AB')
    expect(engine.validateField('code')).toContain('长度不能小于 3')
    engine.setValue('code', 'ABCDEF')
    expect(engine.validateField('code')).toContain('长度不能大于 5')
    engine.setValue('code', 'abc')
    expect(engine.validateField('code')).toContain('格式不正确')
    engine.setValue('code', 'ABC')
    expect(engine.validateField('code')).toBeUndefined()
  })

  it('enum 超出可选范围报错', () => {
    const engine = makeEngine({
      fields: [{ name: 'status', label: '状态', validation: { enum: ['A', 'B'] } }],
    })
    engine.setValue('status', 'C')
    expect(engine.validateField('status')).toContain('不在可选范围内')
    engine.setValue('status', 'A')
    expect(engine.validateField('status')).toBeUndefined()
  })

  it('custom 表达式通过 $form 作用域校验', () => {
    const engine = makeEngine({
      fields: [
        { name: 'amount', label: '金额', validation: { custom: '$form.amount > 0' } },
      ],
    })
    engine.setValue('amount', -5)
    expect(engine.validateField('amount')).toContain('自定义校验')
    engine.setValue('amount', 5)
    expect(engine.validateField('amount')).toBeUndefined()
  })
})

describe('FormEngine 联动与提交', () => {
  it('visible 表达式控制字段是否参与校验', () => {
    const engine = makeEngine({
      fields: [
        { name: 'switch', defaultValue: false },
        { name: 'requiredWhenOn', validation: { required: true }, visible: '$form.switch == true' },
      ],
    })
    expect(engine.isFieldVisible('requiredWhenOn')).toBe(false)
    expect(engine.validate()).toBe(true) // 不可见字段不校验

    engine.setValue('switch', true)
    expect(engine.isFieldVisible('requiredWhenOn')).toBe(true)
    expect(engine.validate()).toBe(false) // 可见且为空 → 必填失败
  })

  it('disabled 表达式控制字段禁用态', () => {
    const engine = makeEngine({
      fields: [
        { name: 'locked', defaultValue: true },
        { name: 'code', disabled: '$form.locked == true' },
      ],
    })
    expect(engine.isFieldDisabled('code')).toBe(true)
    engine.setValue('locked', false)
    expect(engine.isFieldDisabled('code')).toBe(false)
  })

  it('validate 汇总所有可见字段错误', () => {
    const engine = makeEngine({
      fields: [
        { name: 'a', validation: { required: true } },
        { name: 'b', validation: { required: true } },
      ],
    })
    expect(engine.validate()).toBe(false)
    expect(engine.getError('a')).toBeTruthy()
    expect(engine.getError('b')).toBeTruthy()
  })

  it('submit 校验失败不调用 onSubmit', async () => {
    const onSubmit = vi.fn()
    const engine = makeEngine(
      { fields: [{ name: 'a', validation: { required: true } }] },
      onSubmit,
    )
    const ok = await engine.submit()
    expect(ok).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(engine.status).toBe('editing')
  })

  it('submit 校验通过后调用 onSubmit 并置 submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const engine = makeEngine(
      { fields: [{ name: 'a', defaultValue: 1 }] },
      onSubmit,
    )
    const ok = await engine.submit()
    expect(ok).toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ a: 1 })
    expect(engine.status).toBe('submitted')
  })

  it('submit onSubmit 抛错时回退状态并向上抛', async () => {
    const engine = makeEngine(
      { fields: [{ name: 'a', defaultValue: 1 }] },
      async () => {
        throw new Error('服务端拒绝')
      },
    )
    await expect(engine.submit()).rejects.toThrow('服务端拒绝')
    expect(engine.status).toBe('editing')
  })
})
