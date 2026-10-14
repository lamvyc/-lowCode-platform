import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORM_SETTINGS,
  extractCssClassNames,
  getFormSettings,
  normalizeFormSettings,
} from './form-settings'

describe('表单设置 Schema 工具', () => {
  it('normalizeFormSettings 补全默认值且不修改入参', () => {
    const input = { size: 'small' as const }
    const result = normalizeFormSettings(input)

    expect(result.size).toBe('small')
    expect(result.labelPosition).toBe(DEFAULT_FORM_SETTINGS.labelPosition)
    expect(result.modelName).toBe('formData')
    expect(input).toEqual({ size: 'small' })
  })

  it('normalizeFormSettings 对空入参返回默认副本（customClass 不共享引用）', () => {
    const first = normalizeFormSettings()
    const second = normalizeFormSettings()
    first.customClass?.push('demo')

    expect(second.customClass).toEqual([])
    expect(DEFAULT_FORM_SETTINGS.customClass).toEqual([])
  })

  it('getFormSettings 从页面 settings 中读取 form', () => {
    const result = getFormSettings({ form: { labelWidth: 120, customClass: ['a'] } })

    expect(result.labelWidth).toBe(120)
    expect(result.customClass).toEqual(['a'])
    expect(result.size).toBe('default')
  })

  it('getFormSettings 兼容 settings 缺失', () => {
    expect(getFormSettings(undefined).refName).toBe('formRef')
    expect(getFormSettings(null).rulesName).toBe('formRules')
  })

  it('extractCssClassNames 提取各类选择器中的类名并去重', () => {
    const css = `
      /* 注释里的 .ignored 不应被提取 */
      .card { color: red; }
      .card, .panel-title { font-weight: bold; }
      .wrapper .inner:hover { opacity: .8; }
      div.plain > .last { margin: 0; }
    `
    expect(extractCssClassNames(css)).toEqual(['card', 'panel-title', 'wrapper', 'inner', 'plain', 'last'])
  })

  it('extractCssClassNames 对空输入返回空数组', () => {
    expect(extractCssClassNames('')).toEqual([])
    expect(extractCssClassNames(undefined)).toEqual([])
  })
})
