// @vitest-environment happy-dom
import { compileScript, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { normalizePageSchema, type PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '@lowcode/codegen'
import { BUILTIN_TEMPLATES } from '../designer/templates'
import { mountGeneratedSfc } from './generated-harness'

const GENERATED_TEMPLATES = BUILTIN_TEMPLATES.filter(
  (template) => template.id !== 'fixed-table',
)

describe('内置模板生成回归（P1）', () => {
  it.each(GENERATED_TEMPLATES.map((template) => [template.name, template] as const))(
    '%s：生成、编译、无未知物料',
    async (_name, template) => {
      const raw = template.create() as PageSchema
      const normalized = normalizePageSchema(raw)
      for (const schema of [raw, normalized]) {
        const { code, warnings } = await generateVueSfc(schema)
        expect(code).not.toContain('未注册物料')
        expect(code).not.toContain('@lowcode/')
        expect(code).not.toContain('xState')
        expect(() => compileScript(parse(code).descriptor, { id: 't' })).not.toThrow()
        expect(warnings.filter((warning) => warning.code === 'unknown-material')).toEqual([])
        const { wrapper } = await mountGeneratedSfc(code)
        expect(wrapper.find('.lc-page').exists()).toBe(true)
        wrapper.unmount()
      }
    },
  )

  it('登录模板可真实挂载，渲染两个输入框与登录按钮', async () => {
    const schema = BUILTIN_TEMPLATES.find((template) => template.id === 'login')!.create() as PageSchema
    const { code } = await generateVueSfc(schema)
    const { wrapper } = await mountGeneratedSfc(code)
    expect(wrapper.findAll('input').length).toBe(2)
    expect(wrapper.text()).toContain('登录')
    expect(wrapper.text()).toContain('账号登录')
  })

  it('数据列表页可挂载，渲染 el-table 与静态数据行', async () => {
    const schema = BUILTIN_TEMPLATES.find((template) => template.id === 'list')!.create() as PageSchema
    const { code } = await generateVueSfc(schema)
    const { wrapper } = await mountGeneratedSfc(code)
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(wrapper.find('.el-table').exists()).toBe(true)
    expect(wrapper.text()).toContain('张三')
  })

  it('问卷模板可挂载，渲染单选与多选选项', async () => {
    const schema = BUILTIN_TEMPLATES.find((template) => template.id === 'survey')!.create() as PageSchema
    const { code } = await generateVueSfc(schema)
    const { wrapper } = await mountGeneratedSfc(code)
    expect(wrapper.findAll('.el-radio').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.el-checkbox').length).toBeGreaterThan(0)
  })

  it('原始模板即使没有 modelValue 也生成字段', async () => {
    const raw = BUILTIN_TEMPLATES.find((template) => template.id === 'single')!.create() as PageSchema
    const fieldTypes = new Set(['input', 'textarea', 'checkbox', 'switch', 'time-range', 'slider'])
    const expected = raw.nodes.filter((node) => fieldTypes.has(node.type)).length
    const { code } = await generateVueSfc(raw)
    expect((code.match(/<el-form-item/g) ?? []).length).toBe(expected)
  })
})
