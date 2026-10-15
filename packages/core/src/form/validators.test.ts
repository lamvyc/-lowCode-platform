import { describe, expect, it } from 'vitest'
import {
  BUILTIN_PATTERNS,
  UNIMPLEMENTED_VALIDATORS,
  isEmptyValue,
  runBuiltinValidator,
  runPatternValidator,
  runRequiredValidator,
  runValidation,
} from './validators'

const opts = { label: '邮箱' }

describe('isEmptyValue：照搬参考实现的按 length 判空', () => {
  it('null / undefined / 空串 / 空数组 视为空', () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined)).toBe(true)
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
  })

  it('⚠️ 0 / false / 数字 不算空值（length 为 undefined，undefined <= 0 为 false）', () => {
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue(123)).toBe(false)
  })

  it('非空串 / 非空数组 不算空', () => {
    expect(isEmptyValue('abc')).toBe(false)
    expect(isEmptyValue([1])).toBe(false)
  })
})

describe('内置校验器', () => {
  const cases: Array<[string, string, boolean]> = [
    ['number', '123', true],
    ['number', '-1.5', true],
    ['number', '12a', false],
    ['letter', 'abc', true],
    ['letter', 'ab1', false],
    ['letterAndNumber', 'ab12', true],
    ['letterAndNumber', 'ab-1', false],
    ['mobilePhone', '13800138000', true],
    ['mobilePhone', '12345678901', false],
    ['email', 'a@b.com', true],
    ['email', 'a@b', false],
    ['url', 'https://example.com', true],
    ['url', 'ftp://example.com', false],
    ['noChinese', 'abc', true],
    ['noChinese', 'ab中', false],
    ['chinese', '中文', true],
    ['chinese', 'ab中', false],
  ]

  it.each(cases)('%s 校验 %s → %s', (name, value, ok) => {
    const message = runBuiltinValidator(name, value, { label: '字段' })
    if (ok) expect(message).toBeUndefined()
    else expect(message).toBeTypeOf('string')
  })

  it('⚠️ 空值一律放行（必填由 required 规则单独负责，两者不重叠）', () => {
    for (const name of Object.keys(BUILTIN_PATTERNS)) {
      expect(runBuiltinValidator(name, '', { label: '字段' })).toBeUndefined()
      expect(runBuiltinValidator(name, null, { label: '字段' })).toBeUndefined()
      expect(runBuiltinValidator(name, undefined, { label: '字段' })).toBeUndefined()
    }
  })

  it('默认文案带 [label] 前缀', () => {
    expect(runBuiltinValidator('email', 'bad', opts)).toBe('[邮箱]邮箱格式有误')
    expect(runBuiltinValidator('number', 'x', opts)).toBe('[邮箱]包含非数字字符')
  })

  it('errorMsg（validationHint）优先于默认文案', () => {
    expect(runBuiltinValidator('email', 'bad', { label: '邮箱', errorMsg: '请填对邮箱' })).toBe(
      '请填对邮箱',
    )
  })

  it('未知校验器名视为通过', () => {
    expect(runBuiltinValidator('not-a-validator', 'anything', opts)).toBeUndefined()
  })

  it('⚠️ 参考实现里声明但未实现的校验器一律通过', () => {
    expect(UNIMPLEMENTED_VALIDATORS).toEqual(['noBlankStart', 'noBlankEnd'])
    for (const name of UNIMPLEMENTED_VALIDATORS) {
      expect(runBuiltinValidator(name, '任何值', opts)).toBeUndefined()
    }
  })
})

describe('正则校验器（对应参考实现的 regExp）', () => {
  it('按正则源码匹配', () => {
    expect(runPatternValidator('^\\d{4}$', '1234', opts)).toBeUndefined()
    expect(runPatternValidator('^\\d{4}$', '12a4', opts)).toBe('[邮箱]invalid value')
  })

  it('errorMsg 优先', () => {
    expect(runPatternValidator('^\\d{4}$', 'x', { label: '年份', errorMsg: '四位数字' })).toBe(
      '四位数字',
    )
  })

  it('空值放行', () => {
    expect(runPatternValidator('^\\d{4}$', '', opts)).toBeUndefined()
  })

  it('非法正则不抛异常、视为通过', () => {
    expect(() => runPatternValidator('([', 'x', opts)).not.toThrow()
    expect(runPatternValidator('([', 'x', opts)).toBeUndefined()
  })
})

describe('runValidation 统一入口', () => {
  it('命中内置名走内置校验器', () => {
    expect(runValidation('email', 'bad', opts)).toBe('[邮箱]邮箱格式有误')
  })

  it('未命中则当作正则字符串', () => {
    expect(runValidation('^\\d+$', 'abc', opts)).toBe('[邮箱]invalid value')
    expect(runValidation('^\\d+$', '123', opts)).toBeUndefined()
  })
})

describe('必填规则', () => {
  it('空串 / null / undefined / 空数组 报错', () => {
    const message = '字段值不可为空'
    expect(runRequiredValidator('', opts)).toBe(message)
    expect(runRequiredValidator(null, opts)).toBe(message)
    expect(runRequiredValidator(undefined, opts)).toBe(message)
    expect(runRequiredValidator([], opts)).toBe(message)
  })

  it('0 与 false 通过（是有效值）', () => {
    expect(runRequiredValidator(0, opts)).toBeUndefined()
    expect(runRequiredValidator(false, opts)).toBeUndefined()
  })

  it('非空值通过', () => {
    expect(runRequiredValidator('x', opts)).toBeUndefined()
    expect(runRequiredValidator([1], opts)).toBeUndefined()
  })

  it('requiredHint 优先，且默认文案**不带** [label] 前缀', () => {
    expect(runRequiredValidator('', { label: '姓名', errorMsg: '请填写姓名' })).toBe('请填写姓名')
    expect(runRequiredValidator('', { label: '姓名' })).toBe('字段值不可为空')
  })
})
