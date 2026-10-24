import { describe, expect, it } from 'vitest'
import { MATERIAL_MANIFESTS } from '@lowcode/materials'
import { isSchemaEnvelope, normalizePageSchema, parsePageSchema } from '@lowcode/schema'
import { buildOutlineTree, countOutlineNodes } from './outline'
import { REFERENCE_FORM_PRESETS } from './template-presets'
import {
  BUILTIN_TEMPLATES,
  TemplateRegistry,
  registerBuiltinTemplates,
  templateRegistry,
  type PageTemplate,
} from './templates'

function customTemplate(id: string, name: string): PageTemplate {
  return {
    id,
    name,
    description: '测试模板',
    create: () => ({
      version: '1.0.0',
      meta: { id, name, createdAt: '', updatedAt: '' },
      nodes: [{ id: `${id}_root`, type: 'container', props: {}, children: [] }],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    }),
  }
}

describe('页面模板', () => {
  it('内置模板注册幂等且标记为 builtin', () => {
    registerBuiltinTemplates()
    registerBuiltinTemplates()

    const builtins = templateRegistry.list().filter((template) => template.builtin)
    expect(builtins).toHaveLength(BUILTIN_TEMPLATES.length)
    expect(new Set(builtins.map((template) => template.id)).size).toBe(BUILTIN_TEMPLATES.length)
  })

  it('每个内置模板都能通过 Schema 校验', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const schema = template.create()
      expect(isSchemaEnvelope(schema)).toBe(false)
      expect(() => parsePageSchema(schema)).not.toThrow()
    }
  })

  it('内置模板节点都声明了合法 type 与 props', () => {
    // 「空白页面」是合法的空页面，其余模板必须有实质内容
    for (const template of BUILTIN_TEMPLATES) {
      if (template.id === 'blank') continue
      const nodes = normalizePageSchema(template.create()).nodes
      expect(nodes.length).toBeGreaterThanOrEqual(3)
      for (const node of nodes) {
        expect(node.type).toMatch(/^[a-z][\w-]*$/)
        expect(typeof node.props).toBe('object')
      }
    }
    // 物料覆盖由浏览器端用例验证（渲染模板后不出现「未注册物料」占位）
  })

  it('内置模板节点数量与结构可解析', () => {
    const login = BUILTIN_TEMPLATES.find((template) => template.id === 'login')!
    const tree = buildOutlineTree(normalizePageSchema(login.create()).nodes)

    expect(tree).toHaveLength(1)
    expect(countOutlineNodes(tree)).toBe(4)
  })

  it('create() 每次返回全新对象，互不影响', () => {
    const template = BUILTIN_TEMPLATES.find((item) => item.id === 'login')!
    const first = normalizePageSchema(template.create())
    const card = first.nodes.find((node) => node.type === 'card')!
    card.props.label = '被改坏了'

    const second = normalizePageSchema(template.create())
    expect(second.nodes.find((node) => node.type === 'card')?.props.label).toBe('账号登录')
  })

  it('TemplateRegistry 按 id 去重、可删除、可实例化深拷贝', () => {
    const registry = new TemplateRegistry()
    registry.register(customTemplate('t1', '模板一'))
    registry.register(customTemplate('t1', '模板一（重复）'))
    registry.registerMany([customTemplate('t2', '模板二'), customTemplate('t3', '模板三')])

    expect(registry.list().map((item) => item.id)).toEqual(['t1', 't2', 't3'])
    expect(registry.get('t1')?.name).toBe('模板一')

    const instance = normalizePageSchema(registry.instantiate('t1')!)
    instance.nodes.push({ id: 'extra', type: 'text', props: {} })
    expect(normalizePageSchema(registry.instantiate('t1')!).nodes).toHaveLength(1)

    registry.remove('t2')
    expect(registry.list().map((item) => item.id)).toEqual(['t1', 't3'])
    expect(registry.instantiate('missing')).toBeUndefined()
  })
})

describe('参考 variant-form 的表单模板', () => {
  const referenceIds = [
    'single',
    'multi',
    'grouped',
    'tabs',
    'master-detail',
    'responsive',
    'survey',
    'fixed-table',
  ]

  it('8 个参考表单模板全部注册且顺序一致', () => {
    expect(REFERENCE_FORM_PRESETS.map((preset) => preset.id)).toEqual(referenceIds)
    const builtinIds = BUILTIN_TEMPLATES.map((template) => template.id)
    expect(referenceIds.every((id) => builtinIds.includes(id))).toBe(true)
  })

  it('模板只使用已注册物料，且都能通过 Schema 校验', () => {
    const known = new Set(MATERIAL_MANIFESTS.map((material) => material.type))
    for (const preset of REFERENCE_FORM_PRESETS) {
      for (const node of preset.nodes) {
        expect(known.has(node.type), `${preset.id} 使用了未注册物料 ${node.type}`).toBe(true)
      }
      const template = BUILTIN_TEMPLATES.find((item) => item.id === preset.id)!
      expect(() => parsePageSchema(template.create())).not.toThrow()
    }
  })

  it('保留参考模板的表单排版设置（left / 150 / right，固定表格为 80 / left）', () => {
    const single = normalizePageSchema(
      BUILTIN_TEMPLATES.find((template) => template.id === 'single')!.create(),
    )
    expect(single.settings?.form).toMatchObject({
      labelPosition: 'left',
      labelWidth: 150,
      labelAlign: 'right',
    })

    const fixed = normalizePageSchema(
      BUILTIN_TEMPLATES.find((template) => template.id === 'fixed-table')!.create(),
    )
    expect(fixed.settings?.form).toMatchObject({
      labelPosition: 'left',
      labelWidth: 80,
      labelAlign: 'left',
    })
    expect(fixed.settings?.form?.cssCode).toContain('small-margin-bottom')
  })

  it('响应式模板的栅格列带 PC 3 栏 / Pad 2 栏 / H5 1 栏断点', () => {
    const schema = normalizePageSchema(
      BUILTIN_TEMPLATES.find((template) => template.id === 'responsive')!.create(),
    )
    const cols = schema.nodes.filter((node) => node.type === 'grid-col')
    expect(cols.length).toBeGreaterThan(0)
    for (const col of cols) {
      expect(col.props).toMatchObject({ responsive: true, md: 8, sm: 12, xs: 24 })
    }
  })

  it('固定表格模板是 table > row > cell 的简历结构', () => {
    const schema = normalizePageSchema(
      BUILTIN_TEMPLATES.find((template) => template.id === 'fixed-table')!.create(),
    )
    const table = schema.nodes.find((node) => node.type === 'table')!
    expect(table).toBeDefined()
    const rows = (table.children ?? []).map((id) => schema.nodes.find((node) => node.id === id)!)
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows.every((row) => row.type === 'table-row')).toBe(true)
    expect(schema.nodes.some((node) => node.type === 'picture-upload')).toBe(true)
    expect(schema.nodes.some((node) => node.props.textContent === '姓名')).toBe(true)
  })

  it('参考模板实例化后与预设数据隔离（不同页面互不影响）', () => {
    const template = BUILTIN_TEMPLATES.find((item) => item.id === 'single')!
    const first = normalizePageSchema(template.create())
    const input = first.nodes.find((node) => node.type === 'input')!
    input.props.label = '被改坏了'

    const second = normalizePageSchema(template.create())
    expect(second.nodes.find((node) => node.type === 'input')?.props.label).toBe('发件人姓名')
  })
})

describe('页面模板的数据语义', () => {
  it('数据列表页用 data-table，按钮用 label', () => {
    const template = BUILTIN_TEMPLATES.find((item) => item.id === 'list')!
    const schema = template.create()
    expect(schema.nodes.find((node) => 'columns' in node.props)?.type).toBe('data-table')
    const buttons = schema.nodes.filter((node) => node.type === 'button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((node) => typeof node.props.label === 'string')).toBe(true)
    expect(buttons.every((node) => node.props.text === undefined)).toBe(true)
  })
})
