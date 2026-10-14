import { describe, expect, it } from 'vitest'
import { formatCode, validateCode } from './code'

describe('代码编辑器语法校验', () => {
  it('javascript：合法函数体通过，非法语法报错', () => {
    expect(validateCode('const a = 1\nreturn a', 'javascript')).toEqual([])
    expect(validateCode('if (', 'javascript')[0]?.type).toBe('error')
  })

  it('javascript：空代码视为合法', () => {
    expect(validateCode('   \n  ', 'javascript')).toEqual([])
  })

  it('json：解析失败给出错误', () => {
    expect(validateCode('{"a": 1}', 'json')).toEqual([])
    const [annotation] = validateCode('{"a": }', 'json')
    expect(annotation.type).toBe('error')
    expect(annotation.message.length).toBeGreaterThan(0)
  })

  it('css：花括号配平检查', () => {
    expect(validateCode('.a { color: red; }', 'css')).toEqual([])
    expect(validateCode('.a { color: red;', 'css')[0].message).toContain('缺少')
    expect(validateCode('.a { } }', 'css')[0].message).toContain('多余')
  })

  it('html 模式不做语法校验', () => {
    expect(validateCode('<div>', 'html')).toEqual([])
  })

  it('formatCode 仅美化合法 JSON', () => {
    expect(formatCode('{"a":1}', 'json')).toBe('{\n  "a": 1\n}')
    expect(formatCode('{"a":}', 'json')).toBe('{"a":}')
    expect(formatCode('const a=1', 'javascript')).toBe('const a=1')
  })
})
