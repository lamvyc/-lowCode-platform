import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { resolveForm } from './form'
import type { MappingContext } from './mappings/types'
import { sanitizeIdentifier } from './plan'
import { BASE_STYLE, buildNodeClass, buildNodeStyle, buildStyleBlock } from './styles'

function makeSchema(): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '样式测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: { form: { cssCode: '.custom { color: red; }' } },
  }
}

function makeContext(): MappingContext {
  const schema = makeSchema()
  const warnings: MappingContext['warnings'] = []
  return {
    schema,
    nodes: new Map(),
    datasourceIds: [],
    variableNames: ['color'],
    form: resolveForm(schema),
    mode: 'template',
    warnings,
    warn: (code, message, nodeId) => warnings.push({ code, message, nodeId }),
    modelKey: (node) => sanitizeIdentifier(node.name || node.id, node.id),
    prop: (node, name) => node.props[name],
    renderNode: () => ({ kind: 'text', value: '' }),
    renderChildren: () => [],
  }
}

function node(patch: Partial<PageNode>): PageNode {
  return { id: 'n1', type: 'text', props: {}, ...patch } as PageNode
}

describe('buildNodeStyle', () => {
  it('kebab-case 键与字符串值都用 JSON 转义', () => {
    const style = buildNodeStyle(
      node({
        style: {
          'border-radius': { type: 'static', value: '8px' },
          fontFamily: { type: 'static', value: "O'Reilly" },
        },
      }),
      makeContext(),
    )
    expect(style).toContain('"border-radius"')
    expect(style).toContain('"8px"')
    expect(style).toContain('"O\'Reilly"')
  })

  it('表达式样式按模板模式重写', () => {
    const style = buildNodeStyle(
      node({ style: { color: { type: 'expression', value: '$page.color' } } }),
      makeContext(),
    )
    expect(style).toContain('color: color')
  })

  it('没有 style 时返回 undefined', () => {
    expect(buildNodeStyle(node({}), makeContext())).toBeUndefined()
  })
})

describe('buildNodeClass', () => {
  it('class 来自 node.props.class，与 mapping class 合并', () => {
    expect(buildNodeClass(node({ props: { class: ['a', 'b'] } }), 'lc-button')).toBe(
      'lc-button a b',
    )
  })

  it('支持字符串 class 并去重', () => {
    expect(buildNodeClass(node({ props: { class: 'a' } }), 'a')).toBe('a')
  })
})

describe('buildStyleBlock', () => {
  it('样式块含表单/按钮/卡片/栅格基线', () => {
    const plan = {
      schema: makeSchema(),
      rootNodes: [],
      fieldNodes: [],
      modelKeys: new Map(),
      warnings: [],
    }
    const { scoped, global } = buildStyleBlock(plan)
    expect(scoped).toContain('.el-form-item')
    expect(scoped).toContain('.el-button')
    expect(scoped).toContain('.el-card')
    expect(scoped).toContain('.el-row')
    expect(global).toContain('.lc-page')
    expect(global).toContain('.custom')
  })

  it('BASE_STYLE 与 scoped 一致', () => {
    const plan = {
      schema: makeSchema(),
      rootNodes: [],
      fieldNodes: [],
      modelKeys: new Map(),
      warnings: [],
    }
    expect(buildStyleBlock(plan).scoped).toBe(BASE_STYLE)
  })
})
