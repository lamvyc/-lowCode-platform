import { NodeTree, createNodeId } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'

function cloneNode(node: PageNode): PageNode {
  return JSON.parse(JSON.stringify(node)) as PageNode
}

export function applyGroup(
  tree: NodeTree,
  ids: string[],
  container: PageNode,
): PageNode {
  return tree.groupAs(ids, container)
}

export function applyUngroup(tree: NodeTree, containerId: string): PageNode[] {
  const container = tree.find(containerId)
  if (!container?.children?.length) return []
  return tree.ungroup(containerId)
}

export function applyPaste(tree: NodeTree, source: PageNode[]): PageNode[] {
  if (source.length === 0) return []

  const idMap = new Map<string, string>()
  const buildMap = (node: PageNode) => {
    idMap.set(node.id, createNodeId())
    for (const childId of node.children ?? []) {
      const child = source.find((n) => n.id === childId)
      if (child) buildMap(child)
    }
  }
  for (const node of source) buildMap(node)

  const plan: { source: PageNode; newParentId: string | null }[] = []
  const collect = (node: PageNode, newParentId: string | null) => {
    plan.push({ source: node, newParentId })
    for (const childId of node.children ?? []) {
      const child = source.find((n) => n.id === childId)
      if (child) collect(child, idMap.get(node.id) ?? '')
    }
  }
  for (const node of source) collect(node, null)

  const inserted: PageNode[] = []
  for (const item of plan) {
    const newNode: PageNode = {
      ...cloneNode(item.source),
      id: idMap.get(item.source.id) ?? createNodeId(),
      children: item.source.children?.map((id) => idMap.get(id) ?? id),
      slots: item.source.slots
        ? Object.fromEntries(
            Object.entries(item.source.slots).map(([slot, ids]) => [
              slot,
              ids.map((id) => idMap.get(id) ?? id),
            ]),
          )
        : undefined,
    }
    tree.insert(newNode, item.newParentId)
    inserted.push(newNode)
  }
  return inserted
}
