import { comment, el, stringifyTemplate, type TemplateNode } from '../ast'
import { resolveForm } from '../form'
import { sanitizeIdentifier } from '../plan'
import type { PageNode, PageSchema } from '@lowcode/schema'
import type { CodegenWarning, ResolvedForm } from '../types'
import { renderChildren } from './helpers'
import type { MappingContext, MappingRegistry } from './types'

/** 测试用最小 Schema */
function testSchema(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'test',
      name: '测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

/** 测试用空上下文；需要真实渲染时用 renderNodeToTemplate */
export function makeMappingContext(overrides: Partial<MappingContext> = {}): MappingContext {
  const schema = testSchema([])
  const form: ResolvedForm = resolveForm(schema)
  const warnings: CodegenWarning[] = []
  const ctx: MappingContext = {
    schema,
    nodes: new Map(),
    datasourceIds: [],
    variableNames: [],
    form,
    mode: 'template',
    warnings,
    warn: (code, message, nodeId) => warnings.push({ code, message, nodeId }),
    modelKey: (node) => sanitizeIdentifier(node.name || node.id, node.id),
    prop: (node, name) => node.props[name],
    renderNode: () => comment('无渲染器'),
    renderChildren: (node) => renderChildren(node, ctx),
    ...overrides,
  }
  return ctx
}

/**
 * 把单个节点渲染成模板文本（测试用）。
 * extraNodes 用于 children / slots 引用的子节点。
 */
export function renderNodeToTemplate(
  node: PageNode,
  registry: MappingRegistry,
  extraNodes: PageNode[] = [],
): string {
  const all = [node, ...extraNodes]
  const schema = testSchema(all)
  const nodes = new Map(all.map((item) => [item.id, item]))
  const form = resolveForm(schema)
  const warnings: CodegenWarning[] = []

  const ctx: MappingContext = {
    schema,
    nodes,
    datasourceIds: [],
    variableNames: [],
    form,
    mode: 'template',
    warnings,
    warn: (code, message, nodeId) => warnings.push({ code, message, nodeId }),
    modelKey: (item) => sanitizeIdentifier(item.name || item.id, item.id),
    prop: (item, name) => item.props[name],
    renderNode: (item) => render(item),
    renderChildren: (item) => renderChildren(item, ctx),
  }

  const render = (item: PageNode): TemplateNode => {
    const mapping = registry.get(item.type)
    if (!mapping) return comment(`未注册物料: ${item.type}`)
    if (mapping.render) return mapping.render(item, ctx)
    const attrs = { ...mapping.attrs(item, ctx) }
    return el(mapping.tag, attrs, renderChildren(item, ctx))
  }

  return stringifyTemplate(render(node))
}
