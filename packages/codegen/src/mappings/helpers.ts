import { comment, el, type TemplateNode } from '../ast'
import type { MappingContext } from './types'

/** 静态属性（空值不输出） */
export function staticAttr(
  name: string,
  value: unknown,
): Record<string, string | true> {
  if (value === undefined || value === null || value === '') return {}
  return { [name]: String(value) }
}

/** 绑定属性：`:name="expr"` */
export function bindAttr(name: string, value: string): Record<string, string | true> {
  return { [`:${name}`]: value }
}

/** 布尔属性：真值时输出裸属性（`clearable` / `#header`） */
export function boolAttr(name: string, value: unknown): Record<string, string | true> {
  return value ? { [name]: true } : {}
}

/** 渲染 children + 具名插槽（default 回退 slots.default） */
export function renderChildren(node: import('@lowcode/schema').PageNode, ctx: MappingContext): TemplateNode[] {
  const children: TemplateNode[] = []
  const renderIds = (ids: string[]): TemplateNode[] =>
    ids.map((id) => {
      const child = ctx.nodes.get(id)
      return child ? ctx.renderNode(child) : comment(`缺失子节点: ${id}`)
    })
  const defaultIds = node.children ?? node.slots?.default ?? []
  children.push(...renderIds(defaultIds))
  for (const [slot, ids] of Object.entries(node.slots ?? {})) {
    if (slot === 'default') continue
    children.push(el('template', { [`#${slot}`]: true }, renderIds(ids)))
  }
  return children
}


/** Element Plus 图标名（PascalCase，如 Search）；否则按非法图标处理 */
export function isIconName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(value)
}

export function registerIcon(ctx: MappingContext, name: string): string {
  ctx.addImport(name, '@element-plus/icons-vue')
  return name
}
