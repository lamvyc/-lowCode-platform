import type { PageNode } from '@lowcode/schema'

/** 取某容器节点下的直接子节点（可按物料类型过滤，保持 children 顺序） */
export function childNodesOf(
  nodes: PageNode[],
  parent: PageNode,
  type?: string,
): PageNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return (parent.children ?? [])
    .map((id) => byId.get(id))
    .filter((node): node is PageNode => Boolean(node))
    .filter((node) => (type ? node.type === type : true))
}

/**
 * 计算结构数量变化：给定当前子节点 id 列表与目标数量，
 * 返回需要追加的个数与需要删除的 id（从尾部删）。
 */
export function planCountChange(
  currentIds: string[],
  nextCount: number,
): { addCount: number; removeIds: string[] } {
  const target = Math.max(0, Math.floor(nextCount))
  if (target >= currentIds.length) {
    return { addCount: target - currentIds.length, removeIds: [] }
  }
  return { addCount: 0, removeIds: currentIds.slice(target) }
}

/** 数组内移动一项，越界时返回原数组的副本 */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  const next = [...items]
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}
