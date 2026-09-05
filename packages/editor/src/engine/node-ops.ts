import { NodeTree, createNodeId, createUniqueName } from '@lowcode/core'
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

  // 复制后的节点必须生成新的唯一 name（label 属于展示字段，随深拷贝保留）
  const nameMap = new Map<string, string>()
  const takenNames = new Set(tree.getNodes().map((n) => n.name ?? n.id))
  for (const node of source) {
    const name = createUniqueName(node.type, takenNames)
    nameMap.set(node.id, name)
    takenNames.add(name)
  }

  const inserted: PageNode[] = []
  for (const node of source) {
    const newNode: PageNode = {
      ...cloneNode(node),
      id: idMap.get(node.id) ?? createNodeId(),
      name: nameMap.get(node.id),
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

/** 深复制节点子树：全部节点生成新 id 与唯一 name，插入到源节点同父级的紧邻后方 */
export function applyDuplicate(tree: NodeTree, sourceId: string): PageNode[] {
  const source = tree.find(sourceId)
  if (!source) return []

  const descendantIds = tree.getDescendantIds(sourceId)
  const sourceNodes = [source, ...descendantIds.map((id) => tree.find(id)!).filter(Boolean)]

  const idMap = new Map<string, string>()
  for (const node of sourceNodes) idMap.set(node.id, createNodeId())

  const nameMap = new Map<string, string>()
  const takenNames = new Set(tree.getNodes().map((n) => n.name ?? n.id))
  for (const node of sourceNodes) {
    const name = createUniqueName(node.type, takenNames)
    nameMap.set(node.id, name)
    takenNames.add(name)
  }

  const clones: PageNode[] = sourceNodes.map((node) => ({
    ...cloneNode(node),
    id: idMap.get(node.id)!,
    name: nameMap.get(node.id),
    children: node.children?.map((id) => idMap.get(id) ?? id),
    slots: node.slots
      ? Object.fromEntries(
          Object.entries(node.slots).map(([slot, ids]) => [
            slot,
            ids.map((id) => idMap.get(id) ?? id),
          ]),
        )
      : undefined,
  }))

  // 扁平数组追加子节点副本；根副本插入到源节点同父级的紧邻后方
  const rootClone = clones[0]
  const rest = clones.slice(1)
  for (const clone of rest) tree.getNodes().push(clone)

  const position = tree.getPosition(sourceId)
  if (position.parentId === null) {
    tree.getRoot().splice(position.index + 1, 0, rootClone)
  } else {
    tree.getNodes().push(rootClone)
    const parent = tree.get(position.parentId)
    const list =
      position.slot && position.slot !== 'default'
        ? parent.slots![position.slot]!
        : parent.children!
    list.splice(position.index + 1, 0, rootClone.id)
  }
  return clones
}
