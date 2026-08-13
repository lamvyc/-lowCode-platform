import { describe, expect, it } from 'vitest'
import { compactLayout, findDropPosition } from '@lowcode/core'

const grid = { columns: 12, rowHeight: 30, margin: 10 }

describe('layout/grid 网格布局', () => {
  it('findDropPosition 计算第一格位置', () => {
    const pos = findDropPosition([], { x: 5, y: 5 }, grid, 100)
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(0)
    expect(pos.w).toBe(1)
    expect(pos.h).toBe(1)
  })

  it('findDropPosition 根据指针列计算 x', () => {
    const pos = findDropPosition([], { x: 230, y: 5 }, grid, 100)
    expect(pos.x).toBe(2)
  })

  it('findDropPosition 跳过被占用的行', () => {
    const pos = findDropPosition(
      [{ x: 0, y: 0, w: 2, h: 1 }],
      { x: 5, y: 5 },
      grid,
      100,
    )
    expect(pos.y).toBe(1)
  })

  it('compactLayout 上移悬浮项', () => {
    const items = compactLayout([
      { x: 0, y: 5, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
    ])
    expect(items.find((i) => i.x === 0)?.y).toBe(0)
  })
})
