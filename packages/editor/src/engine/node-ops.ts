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
  for (const node of source) idMap.set(node.id, createNodeId())

  const inserted: PageNode[] = []
  for (const node of source) {
    const newNode: PageNode = {
      ...cloneNode(node),
      id: idMap.get(node.id) ?? createNodeId(),
      children: node.children?.map((id) => idMap.get(id) ?? id),
      slots: node.slots
        ? Object.fromEntries(
            Object.entries(node.slots).map(([slot, ids]) => [
              slot,
              ids.map((id) => idMap.get(id) ?? id),
            ]),
          )
        : undefined,
    }
    // 追加到扁平数组；父子关系由 remapped children/slots 引用维护，避免重复挂载
    tree.insert(newNode, null)
    inserted.push(newNode)
  }
  return inserted
}
