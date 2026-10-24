import { comment, type TemplateNode } from '../ast'
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

/** 渲染节点的 children（P0 只处理默认插槽；具名插槽在 P1） */
export function renderChildren(node: import('@lowcode/schema').PageNode, ctx: MappingContext): TemplateNode[] {
  const children: TemplateNode[] = []
  for (const id of node.children ?? []) {
    const child = ctx.nodes.get(id)
    children.push(child ? ctx.renderNode(child) : comment(`缺失子节点: ${id}`))
  }
  return children
}
