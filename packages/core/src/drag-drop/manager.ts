import type { PageNode } from '@lowcode/schema'
import type { NodeTree } from '../node-tree'

/** 矩形区域（编辑器 DOM 几何） */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** 落点位置：目标前 / 目标后 / 目标内部 / 根 */
export type DropPosition = 'before' | 'after' | 'inside' | 'root'

/** 拖拽载荷：来自物料面板还是画布内移动 */
export interface DragPayload {
  source: 'material' | 'canvas'
  materialType?: string
  nodeId?: string
}

/** 计算出的落点 */
export interface DropTarget {
  parentId: string | null
  slot?: string
  position: DropPosition
  /** 目标下标（编辑器据此调用 NodeTree.move） */
  index: number
  /** 指针悬停的节点 id */
  targetId?: string
  beforeId?: string
  afterId?: string
}

export interface DropValidationResult {
  ok: boolean
  reason?: string
}

/**
 * 拖拽管理器：把指针几何信息转换为结构化的 DropTarget。
 * 纯计算、无 DOM 依赖，Editor 传入 getBoundingClientRect 的结果。
 */
export class DragDropManager {
  computeDropTarget(
    tree: NodeTree,
    _payload: DragPayload,
    over: { node: PageNode; rect: Rect; depth?: number } | null,
    pointer: { x: number; y: number },
    _rootRect?: Rect,
  ): DropTarget {
    if (!over) {
      return { parentId: null, position: 'root', index: tree.getRoot().length }
    }

    const { node, rect } = over
    const ratio = rect.height > 0 ? (pointer.y - rect.top) / rect.height : 0

    // 上下 1/3 为 before/after，中间为 inside
    if (ratio < 1 / 3) {
      const located = this.locateIndex(tree, node.id)
      return {
        parentId: located.parentId,
        slot: located.slot,
        position: 'before',
        index: located.index,
        targetId: node.id,
        beforeId: node.id,
      }
    }
    if (ratio > 2 / 3) {
      const located = this.locateIndex(tree, node.id)
      return {
        parentId: located.parentId,
        slot: located.slot,
        position: 'after',
        index: located.index + 1,
        targetId: node.id,
        afterId: node.id,
      }
    }

    // inside：目标父节点变为当前节点
    return {
      parentId: node.id,
      slot: 'default',
      position: 'inside',
      index: (node.children?.length ?? 0) + Object.values(node.slots ?? {}).reduce(
        (sum, ids) => sum + ids.length,
        0,
      ),
      targetId: node.id,
    }
  }

  /** 校验落点合法性（如禁止移动到自身后代） */
  validateDrop(
    tree: NodeTree,
    payload: DragPayload,
    target: DropTarget,
  ): DropValidationResult {
    if (payload.source === 'canvas' && payload.nodeId) {
      if (target.parentId === null) return { ok: true }
      return tree.canMove(payload.nodeId, { parentId: target.parentId })
    }
    if (payload.source === 'material' && payload.materialType) {
      // 物料是否可容纳子节点由 Editor 层结合 MaterialRegistry 判断
      return { ok: true }
    }
    return { ok: false, reason: '未知拖拽来源' }
  }

  /** 定位节点在父级列表中的下标 */
  private locateIndex(
    tree: NodeTree,
    nodeId: string,
  ): { parentId: string | null; slot?: string; index: number } {
    const parent = tree.getParent(nodeId)
    if (!parent) {
      return { parentId: null, index: tree.getRoot().findIndex((n) => n.id === nodeId) }
    }
    const list = parent.slot && parent.slot !== 'default'
      ? parent.node.slots?.[parent.slot] ?? []
      : parent.node.children ?? []
    return { parentId: parent.node.id, slot: parent.slot, index: list.indexOf(nodeId) }
  }
}
