import { el, type TemplateNode } from '../ast'
import { isExpressionBinding, type PageNode } from '@lowcode/schema'
import { rewriteExpression } from '../expressions'
import { boolAttr } from './helpers'
import type { MappingContext, MappingRegistry } from './types'

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function tableAttrs(node: PageNode, ctx: MappingContext): Record<string, string | true> {
  const attrs: Record<string, string | true> = {}
  const data = node.props.data
  if (isExpressionBinding(data)) {
    attrs[':data'] = rewriteExpression(data.value, ctx.datasourceIds, ctx.variableNames, 'template')
  } else if (data !== undefined) {
    attrs[':data'] = JSON.stringify(data)
  }
  Object.assign(attrs, boolAttr('stripe', node.props.stripe === true))
  Object.assign(attrs, boolAttr('border', node.props.border !== false))
  return attrs
}

function columnNodes(node: PageNode): TemplateNode[] {
  const columns = Array.isArray(node.props.columns) ? node.props.columns : []
  return columns.map((column) => {
    const config = column as Record<string, unknown>
    const attrs: Record<string, string | true> = {
      prop: str(config.prop),
      label: str(config.label),
    }
    if (config.width !== undefined && config.width !== null && config.width !== '') {
      attrs.width = str(config.width)
    }
    return el('el-table-column', attrs, [])
  })
}

/** P1 高级物料：数据表格（上传/富文本在后续任务追加） */
export function registerAdvancedMappings(registry: MappingRegistry): void {
  registry.register('data-table', {
    tag: 'el-table',
    attrs: (node, ctx) => tableAttrs(node, ctx),
    render: (node, ctx) => el('el-table', tableAttrs(node, ctx), columnNodes(node)),
  })
}
