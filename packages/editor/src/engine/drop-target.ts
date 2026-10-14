import type { DropTarget } from '@lowcode/core'

/** 矩形（画布坐标系） */
export interface DropRect {
  left: number
  top: number
  width: number
  height: number
}

/** 列表主轴：纵向堆叠用 y，横向排列（栅格行 / 横向容器）用 x */
export type DropAxis = 'x' | 'y'

/** 指示条厚度（与 variant-form 的 ghost 一致：3px 主色条） */
export const INDICATOR_THICKNESS = 3
/** 指示条与相邻节点的间距 */
const INDICATOR_GAP = 2
/** 空列表指示条最小长度 */
const MIN_INDICATOR_LENGTH = 24

export interface ListDropInput {
  /** 容器节点 id；null 表示根列表 */
  containerId: string | null
  /** 列表内参与计算的子节点 id（DOM 顺序；拖动自身时已被排除） */
  childIds: string[]
  /** 与 childIds 一一对应的子节点矩形 */
  childRects: DropRect[]
  /** 列表自身矩形（空列表时用于放置指示条） */
  listRect: DropRect
  axis: DropAxis
  pointer: { x: number; y: number }
}

export interface ListDropResult {
  target: DropTarget
  /** 指示条矩形（画布坐标系） */
  indicator: DropRect
  /** 插入下标（0..childIds.length） */
  index: number
}

/** 沿主轴取矩形中点 */
function middleOf(rect: DropRect, axis: DropAxis): number {
  return axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
}

/** 沿主轴取矩形末边 */
function endOf(rect: DropRect, axis: DropAxis): number {
  return axis === 'x' ? rect.left + rect.width : rect.top + rect.height
}

/** 沿交叉轴取起始 / 结束边 */
function crossRange(rects: DropRect[], axis: DropAxis): { start: number; end: number } {
  if (rects.length === 0) return { start: 0, end: 0 }
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const rect of rects) {
    const from = axis === 'x' ? rect.top : rect.left
    const to = axis === 'x' ? rect.top + rect.height : rect.left + rect.width
    start = Math.min(start, from)
    end = Math.max(end, to)
  }
  return { start, end }
}

/**
 * 计算插入下标：指针越过某个子节点的中线时插到它后面。
 * 与 Sortable 的判定一致，落点在节点中线之前 → 插到它前面。
 */
export function resolveInsertionIndex(
  childRects: DropRect[],
  axis: DropAxis,
  pointer: { x: number; y: number },
): number {
  const value = axis === 'x' ? pointer.x : pointer.y
  for (let index = 0; index < childRects.length; index += 1) {
    if (value < middleOf(childRects[index], axis)) return index
  }
  return childRects.length
}

/**
 * 计算指示条几何：
 * - 列表非空：贴在目标相邻节点之间的间隙（首项之前 / 末项之后 / 两项之间）
 * - 列表为空：贴在容器内容区起点
 */
export function resolveIndicatorRect(input: {
  axis: DropAxis
  listRect: DropRect
  childRects: DropRect[]
  index: number
}): DropRect {
  const { axis, listRect, childRects, index } = input

  if (childRects.length === 0) {
    const length = Math.max(
      axis === 'y' ? listRect.width - INDICATOR_GAP * 2 : listRect.height - INDICATOR_GAP * 2,
      MIN_INDICATOR_LENGTH,
    )
    return axis === 'y'
      ? {
          left: listRect.left + INDICATOR_GAP,
          top: listRect.top + INDICATOR_GAP,
          width: length,
          height: INDICATOR_THICKNESS,
        }
      : {
          left: listRect.left + INDICATOR_GAP,
          top: listRect.top + INDICATOR_GAP,
          width: INDICATOR_THICKNESS,
          height: length,
        }
  }

  const first = childRects[0]
  const last = childRects[childRects.length - 1]
  const cross = crossRange(childRects, axis)
  const crossLength = Math.max(cross.end - cross.start, MIN_INDICATOR_LENGTH)

  let position: number
  if (index <= 0) {
    position = (axis === 'x' ? first.left : first.top) - INDICATOR_GAP
  } else if (index >= childRects.length) {
    position = endOf(last, axis) + INDICATOR_GAP
  } else {
    position = (endOf(childRects[index - 1], axis) + (axis === 'x' ? childRects[index].left : childRects[index].top)) / 2
  }

  return axis === 'y'
    ? {
        left: cross.start,
        top: position,
        width: crossLength,
        height: INDICATOR_THICKNESS,
      }
    : {
        left: position,
        top: cross.start,
        width: INDICATOR_THICKNESS,
        height: crossLength,
      }
}

/**
 * 由列表度量得到落点与指示条。
 * 落点优先用 beforeId 表达「插到某个兄弟节点之前」，避免同容器移动时的下标偏移；
 * 追加到末尾时只给 index（= 列表长度）。
 */
export function computeListDrop(input: ListDropInput): ListDropResult {
  const index = resolveInsertionIndex(input.childRects, input.axis, input.pointer)
  const beforeId = input.childIds[index]
  return {
    index,
    target: {
      parentId: input.containerId,
      slot: 'default',
      position: input.containerId === null ? 'root' : 'inside',
      index,
      beforeId,
      targetId: input.containerId ?? undefined,
    },
    indicator: resolveIndicatorRect({
      axis: input.axis,
      listRect: input.listRect,
      childRects: input.childRects,
      index,
    }),
  }
}
