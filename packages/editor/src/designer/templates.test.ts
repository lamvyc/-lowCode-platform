import { describe, expect, it } from 'vitest'
import { isSchemaEnvelope, normalizePageSchema, parsePageSchema } from '@lowcode/schema'
import { buildOutlineTree, countOutlineNodes } from './outline'
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
    for (const template of BUILTIN_TEMPLATES) {
      const nodes = normalizePageSchema(template.create()).nodes
      expect(nodes.length).toBeGreaterThan(0)
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
    expect(countOutlineNodes(tree)).toBe(5)
  })

  it('create() 每次返回全新对象，互不影响', () => {
    const template = BUILTIN_TEMPLATES[0]
    const first = normalizePageSchema(template.create())
    first.nodes[0].props.direction = 'row'

    const second = normalizePageSchema(template.create())
    expect(second.nodes[0].props.direction).not.toBe('row')
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
