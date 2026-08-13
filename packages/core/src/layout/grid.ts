import type { LayoutPosition } from '@lowcode/schema'

/** 网格配置 */
export interface GridConfig {
  columns: number
  rowHeight: number
  margin: number
  padding?: number
}

function overlaps(a: LayoutPosition, b: LayoutPosition): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

/**
 * 计算拖放落点对应的网格位置：
 * 根据指针坐标换算列/行，再向下寻找第一个无冲突的行。
 */
export function findDropPosition(
  existing: LayoutPosition[],
  pointer: { x: number; y: number },
  grid: GridConfig,
  columnWidth: number,
): LayoutPosition {
  const col = Math.max(
    0,
    Math.min(
      grid.columns - 1,
      Math.floor(pointer.x / (columnWidth + grid.margin)),
    ),
  )
  let row = Math.max(0, Math.floor(pointer.y / (grid.rowHeight + grid.margin)))
  const candidate: LayoutPosition = { x: col, y: row, w: 1, h: 1 }
  while (existing.some((item) => overlaps(item, candidate))) {
    row += 1
    candidate.y = row
  }
  return { ...candidate }
}

/** 压缩布局：把悬浮项上移到第一个空闲行 */
export function compactLayout(items: LayoutPosition[]): LayoutPosition[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const placed: LayoutPosition[] = []
  for (const item of sorted) {
    let y = 0
    while (placed.some((p) => overlaps(p, { ...item, y }))) {
      y += 1
    }
    placed.push({ ...item, y })
  }
  return placed
}

/** 判断两个网格项是否重叠 */
export function isOverlap(a: LayoutPosition, b: LayoutPosition): boolean {
  return overlaps(a, b)
}
