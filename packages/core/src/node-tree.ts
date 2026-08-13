import type { PageNode } from '@lowcode/schema'

/** 移动目标描述 */
export interface MoveOptions {
  /** 目标父节点 id；null 表示根 */
  parentId: string | null
  /** 目标插槽名，默认 default */
  slot?: string
  /** 目标下标 */
  index?: number
  /** 插入到某节点之前（优先级高于 index） */
  beforeId?: string
}

export interface MoveCheckResult {
  ok: boolean
  reason?: string
}

/**
 * 节点树：基于平铺 nodes 数组的树结构操作。
 * 修改是就地进行的，配合 Immer produce 即可获得补丁用于撤销/重做。
 */
export class NodeTree {
  constructor(private nodes: PageNode[] = []) {}

  getNodes(): PageNode[] {
    return this.nodes
  }

  setNodes(nodes: PageNode[]): void {
    this.nodes = nodes
  }

  /** 根节点列表 */
  getRoot(): PageNode[] {
    return this.nodes
  }

  find(id: string): PageNode | undefined {
    return this.nodes.find((node) => node.id === id)
  }

  /** 查找节点，不存在则抛错 */
  get(id: string): PageNode {
    const node = this.find(id)
    if (!node) throw new Error(`节点不存在: ${id}`)
    return node
  }

  /** 查找父节点（含插槽信息） */
  getParent(id: string): { node: PageNode; slot?: string } | undefined {
    for (const node of this.nodes) {
      if (node.children?.includes(id)) {
        return { node, slot: 'default' }
      }
      if (node.slots) {
        for (const [slot, ids] of Object.entries(node.slots)) {
          if (ids.includes(id)) return { node, slot }
        }
      }
    }
    return undefined
  }

  /**
   * 节点路径（不含页面根容器自身）。
   * 例如 root → b → c，getPath('c') 返回 ['b', 'c']。
   */
  getPath(id: string): string[] {
    const path: string[] = []
    let current: PageNode | undefined = this.find(id)
    while (current) {
      path.unshift(current.id)
      current = this.getParent(current.id)?.node
    }
    if (path.length > 0 && this.isRootLevel(path[0])) {
      path.shift()
    }
    return path
  }

  /** 节点是否为根级节点 */
  isRootLevel(id: string): boolean {
    return this.nodes.some((node) => node.id === id)
  }

  /** id 是否为 ancestor 的后代 */
  isDescendant(id: string, ancestorId: string): boolean {
    let current = this.find(id)
    while (current) {
      const parent = this.getParent(current.id)
      if (!parent) return false
      if (parent.node.id === ancestorId) return true
      current = parent.node
    }
    return false
  }

  /** 获取某节点的全部后代 id */
  getDescendantIds(id: string): string[] {
    const result: string[] = []
    const stack = [id]
    while (stack.length > 0) {
      const current = stack.pop()!
      const node = this.find(current)
      if (!node) continue
      const children = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()]
      for (const child of children) {
        result.push(child)
        stack.push(child)
      }
    }
    return result
  }

  /** 插入节点：parentId 为 null 时插入根 */
  insert(node: PageNode, parentId: string | null, slot?: string, index?: number): PageNode {
    if (parentId === null) {
      this.nodes.splice(Math.min(index ?? this.nodes.length, this.nodes.length), 0, node)
    } else {
      this.nodes.push(node)
      const parent = this.get(parentId)
      const list = this.getSlotList(parent, slot ?? 'default')
      list.splice(Math.min(index ?? list.length, list.length), 0, node.id)
    }
    return node
  }

  /** 更新节点（返回新节点） */
  update(id: string, updater: (node: PageNode) => PageNode): PageNode {
    const index = this.nodes.findIndex((node) => node.id === id)
    if (index < 0) throw new Error(`节点不存在: ${id}`)
    const next = updater(this.nodes[index])
    this.nodes[index] = next
    return next
  }

  /** 合并修改节点 props */
  updateProps(id: string, props: Record<string, unknown>): PageNode {
    return this.update(id, (node) => ({ ...node, props: { ...node.props, ...props } }))
  }

  /** 删除节点并级联删除后代 */
  remove(id: string): PageNode {
    const removed = this.find(id)
    if (!removed) throw new Error(`节点不存在: ${id}`)
    const descendants = this.getDescendantIds(id)
    this.detachFromParent(id)
    this.nodes = this.nodes.filter((node) => node.id !== id && !descendants.includes(node.id))
    return removed
  }

  /** 移动合法性检查 */
  canMove(id: string, options: MoveOptions): MoveCheckResult {
    if (!this.find(id)) return { ok: false, reason: `节点不存在: ${id}` }
    if (options.parentId === id) return { ok: false, reason: '不能移动到自身内部' }
    if (options.parentId !== null) {
      if (!this.find(options.parentId)) return { ok: false, reason: '目标容器不存在' }
      if (this.isDescendant(options.parentId, id)) {
        return { ok: false, reason: '不能移动到自己的后代节点中' }
      }
    }
    return { ok: true }
  }

  /** 移动节点（跨容器 / 排序） */
  move(id: string, options: MoveOptions): PageNode {
    const check = this.canMove(id, options)
    if (!check.ok) throw new Error(check.reason)
    const node = this.get(id)
    const original = this.locate(id)
    this.detachFromParent(id)

    if (options.parentId === null) {
      // 从根级列表移除旧位置（若节点原本就在根级）
      this.nodes = this.nodes.filter((n) => n.id !== id)
      const index = this.resolveIndex(options, original, this.nodes)
      this.nodes.splice(Math.min(index, this.nodes.length), 0, node)
    } else {
      // 根级节点被 detach 移出 nodes 后需要重新加入
      if (!this.nodes.some((n) => n.id === id)) {
        this.nodes.push(node)
      }
      const parent = this.get(options.parentId)
      const slot = options.slot ?? 'default'
      const list = this.getSlotList(parent, slot)
      const index = this.resolveIndex(options, original, list)
      list.splice(Math.min(index, list.length), 0, id)
    }
    return node
  }

  /** 组合：把多个节点移入一个新容器 */
  groupAs(ids: string[], container: PageNode): PageNode {
    const validIds = ids.filter((id) => this.find(id))
    if (validIds.length === 0) {
      throw new Error('没有可组合的节点')
    }
    this.nodes.push(container)
    container.children = []
    for (const id of validIds) {
      this.move(id, { parentId: container.id, index: container.children.length })
    }
    return container
  }

  /** 取消组合：把容器子节点移回容器原父级并删除容器 */
  ungroup(containerId: string): PageNode[] {
    const container = this.get(containerId)
    const parent = this.getParent(containerId)
    const ids = [...(container.children ?? [])]
    for (const id of ids) {
      if (parent) {
        this.move(id, {
          parentId: parent.node.id,
          slot: parent.slot,
          index: (parent.node.children ?? []).length,
        })
      } else {
        this.move(id, { parentId: null, index: this.nodes.length })
      }
    }
    this.remove(containerId)
    return ids.map((id) => this.get(id))
  }

  /** 定位节点：返回其在父级列表中的位置信息 */
  private locate(id: string): { parentId: string | null; slot?: string; index: number } {
    const parent = this.getParent(id)
    if (!parent) {
      return { parentId: null, index: this.nodes.findIndex((n) => n.id === id) }
    }
    const list = this.getSlotList(parent.node, parent.slot ?? 'default')
    return { parentId: parent.node.id, slot: parent.slot, index: list.indexOf(id) }
  }

  /** 解析目标下标：同容器移动时需要修正删除带来的偏移 */
  private resolveIndex(
    options: MoveOptions,
    original: { parentId: string | null; slot?: string; index: number },
    list: unknown[],
  ): number {
    if (options.beforeId !== undefined) {
      const index = list.findIndex((id) => id === options.beforeId)
      return index < 0 ? list.length : index
    }
    let index = options.index ?? list.length
    const sameParent =
      original.parentId === options.parentId && original.slot === (options.slot ?? 'default')
    if (sameParent && original.index < index) {
      index -= 1
    }
    return Math.max(0, index)
  }

  private detachFromParent(id: string): void {
    const parent = this.getParent(id)
    if (!parent) {
      this.nodes = this.nodes.filter((node) => node.id !== id)
      return
    }
    const list = this.getSlotList(parent.node, parent.slot ?? 'default')
    const index = list.indexOf(id)
    if (index >= 0) list.splice(index, 1)
  }

  /** 获取插槽的子节点 id 数组（不存在则创建） */
  private getSlotList(parent: PageNode, slot: string): string[] {
    if (slot === 'default') {
      if (!parent.children) parent.children = []
      return parent.children
    }
    if (!parent.slots) parent.slots = {}
    if (!parent.slots[slot]) parent.slots[slot] = []
    return parent.slots[slot]
  }
}
