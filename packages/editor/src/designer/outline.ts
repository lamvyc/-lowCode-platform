import type { Material, PageNode } from '@lowcode/schema'

/** 大纲树节点：供「组件层次结构树」面板渲染 */
export interface OutlineNode {
  /** 唯一 key：真实节点用 node.id，插槽分组用 `${parentId}::slot::${slot}` */
  id: string
  /** 展示名：优先 props.label，其次唯一名称，最后回落到类型 */
  label: string
  /** 物料类型 */
  type: string
  /** 物料展示名（类型徽标） */
  typeName: string
  /** 是否被隐藏（meta.hidden） */
  hidden: boolean
  /** 是否可被选中：插槽分组节点不可选中 */
  selectable: boolean
  /** 具名插槽分组标记 */
  slot?: string
  children: OutlineNode[]
}

export interface BuildOutlineOptions {
  /** 物料展示名解析：type → 名称 */
  resolveTypeName?: (type: string) => string | undefined
  /** 取物料（用于展示名与图标扩展） */
  resolveMaterial?: (type: string) => Material | undefined
}

function nodeLabel(node: PageNode, typeName: string): string {
  const label = node.props?.label
  if (typeof label === 'string' && label.trim()) return label
  return node.name ?? typeName ?? node.id
}

/**
 * 平铺 nodes → 层次结构树。
 * - `children` 为默认插槽内容；`slots` 中除 default 外的具名插槽会生成不可选中的分组节点
 * - 同一节点只出现一次（防御脏 schema 中 children 与 slots 重复引用）
 * - 缺失引用的子节点会生成「已丢失」占位，避免整棵树渲染中断
 */
export function buildOutlineTree(
  nodes: PageNode[],
  options: BuildOutlineOptions = {},
): OutlineNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visited = new Set<string>()

  const typeNameOf = (type: string): string =>
    options.resolveTypeName?.(type) ?? options.resolveMaterial?.(type)?.name ?? type

  function build(node: PageNode, depth = 0, index = 0): OutlineNode {
    visited.add(node.id)
    const typeName = typeNameOf(node.type)
    const material = options.resolveMaterial?.(node.type)
    // 内部结构物料（栅格列 / 表格行 / 单元格）显示物料名 + 序号，避免展示自动生成的节点名
    const label = material?.hidden
      ? `${material.name} ${index + 1}`
      : nodeLabel(node, typeName)
    const children: OutlineNode[] = []

    // 默认插槽：children 优先，缺失时回落到 slots.default
    const defaultIds = node.children ?? node.slots?.default ?? []
    for (const [childIndex, childId] of defaultIds.entries()) {
      const child = byId.get(childId)
      if (!child) {
        children.push(missingNode(childId))
        continue
      }
      if (visited.has(childId) || depth > 64) continue
      children.push(build(child, depth + 1, childIndex))
    }

    // 具名插槽分组（排除 default，避免与 children 重复）
    for (const [slot, ids] of Object.entries(node.slots ?? {})) {
      if (slot === 'default' || ids.length === 0) continue
      const slotChildren: OutlineNode[] = []
      for (const [childIndex, childId] of ids.entries()) {
        if (visited.has(childId) || depth > 64) continue
        const child = byId.get(childId)
        if (!child) {
          slotChildren.push(missingNode(childId))
          continue
        }
        slotChildren.push(build(child, depth + 1, childIndex))
      }
      children.push({
        id: `${node.id}::slot::${slot}`,
        label: `#${slot}`,
        type: 'slot',
        typeName: '插槽',
        hidden: false,
        selectable: false,
        slot,
        children: slotChildren,
      })
    }

    return {
      id: node.id,
      label,
      type: node.type,
      typeName,
      hidden: Boolean(node.meta?.hidden),
      selectable: true,
      children,
    }
  }

  function missingNode(id: string): OutlineNode {
    return {
      id,
      label: `⚠ 缺失节点 ${id}`,
      type: 'missing',
      typeName: '缺失',
      hidden: false,
      selectable: false,
      children: [],
    }
  }

  const roots: OutlineNode[] = []
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    if (isReferenced(node.id, nodes)) continue
    roots.push(build(node))
  }
  return roots
}

/** 判断节点是否被其他节点引用（子节点或插槽），被引用的不是根 */
function isReferenced(id: string, nodes: PageNode[]): boolean {
  return nodes.some(
    (node) =>
      node.id !== id &&
      ((node.children ?? []).includes(id) ||
        Object.values(node.slots ?? {}).some((ids) => ids.includes(id))),
  )
}

/** 在树中按 id（含插槽分组 key）查找节点 */
export function findOutlineNode(
  tree: OutlineNode[],
  id: string,
): OutlineNode | undefined {
  const stack = [...tree]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.id === id) return current
    stack.push(...current.children)
  }
  return undefined
}

/** 树的真实节点数量（不含插槽分组与缺失占位） */
export function countOutlineNodes(tree: OutlineNode[]): number {
  let count = 0
  const stack = [...tree]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.type !== 'slot' && current.type !== 'missing') count += 1
    stack.push(...current.children)
  }
  return count
}

/** 从根到目标的 id 路径（用于展开定位）；未找到返回空数组 */
export function outlinePathTo(tree: OutlineNode[], id: string): string[] {
  const path: string[] = []

  function walk(nodes: OutlineNode[]): boolean {
    for (const node of nodes) {
      path.push(node.id)
      if (node.id === id) return true
      if (node.children.length > 0 && walk(node.children)) return true
      path.pop()
    }
    return false
  }

  return walk(tree) ? path : []
}
