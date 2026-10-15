import { describe, expect, it } from 'vitest'
import {
  INDICATOR_THICKNESS,
  computeListDrop,
  resolveIndicatorRect,
  resolveInsertionIndex,
  visibleIndexToSchemaIndex,
  type DropRect,
} from './drop-target'

/** 生成纵向堆叠的三个节点矩形（高 40，间隔 4） */
function columnRects(): DropRect[] {
  return [
    { left: 10, top: 0, width: 200, height: 40 },
    { left: 10, top: 44, width: 200, height: 40 },
    { left: 10, top: 88, width: 200, height: 40 },
  ]
}

/** 生成横向排列的三个节点矩形（宽 80，间隔 4） */
function rowRects(): DropRect[] {
  return [
    { left: 0, top: 0, width: 80, height: 60 },
    { left: 84, top: 0, width: 80, height: 60 },
    { left: 168, top: 0, width: 80, height: 60 },
  ]
}

describe('插入下标解析（Sortable 中线规则）', () => {
  it('纵列表：指针在各节点中线上方/下方时得到正确下标', () => {
    const rects = columnRects()
    const at = (y: number) => resolveInsertionIndex(rects, 'y', { x: 100, y })

    expect(at(-10)).toBe(0) // 第一个之前
    expect(at(10)).toBe(0) // 第一个中线（20）之前
    expect(at(30)).toBe(1) // 越过第一个中线（20）
    expect(at(60)).toBe(1) // 第二个中线（64）之前
    expect(at(70)).toBe(2) // 越过第二个中线（64）
    expect(at(200)).toBe(3) // 末尾追加
  })

  it('横列表：按 x 轴中线判定', () => {
    const rects = rowRects()
    const at = (x: number) => resolveInsertionIndex(rects, 'x', { x, y: 30 })

    expect(at(-5)).toBe(0)
    expect(at(30)).toBe(0) // 第一个中线（40）之前
    expect(at(50)).toBe(1)
    expect(at(130)).toBe(2)
    expect(at(400)).toBe(3)
  })

  it('空列表恒为 0', () => {
    expect(resolveInsertionIndex([], 'y', { x: 0, y: 999 })).toBe(0)
  })
})

describe('指示条几何', () => {
  const listRect: DropRect = { left: 0, top: 0, width: 240, height: 200 }

  it('首项之前 / 末项之后 / 两项之间', () => {
    const rects = columnRects()

    const first = resolveIndicatorRect({ axis: 'y', listRect, childRects: rects, index: 0 })
    expect(first.top).toBe(-2)
    expect(first.left).toBe(10)
    expect(first.width).toBe(200)
    expect(first.height).toBe(INDICATOR_THICKNESS)

    const last = resolveIndicatorRect({ axis: 'y', listRect, childRects: rects, index: 3 })
    expect(last.top).toBe(130)

    // 第 1、2 项之间：中点 = (40 + 44) / 2 = 42
    const between = resolveIndicatorRect({ axis: 'y', listRect, childRects: rects, index: 1 })
    expect(between.top).toBe(42)
  })

  it('横列表的指示条为竖线', () => {
    const rects = rowRects()
    const indicator = resolveIndicatorRect({ axis: 'x', listRect, childRects: rects, index: 1 })

    expect(indicator.width).toBe(INDICATOR_THICKNESS)
    expect(indicator.left).toBe(82) // (80 + 84) / 2
    expect(indicator.top).toBe(0)
    expect(indicator.height).toBe(60)
  })

  it('空列表贴在容器内容区起点，且有最小长度', () => {
    const indicator = resolveIndicatorRect({
      axis: 'y',
      listRect: { left: 5, top: 6, width: 10, height: 100 },
      childRects: [],
      index: 0,
    })

    expect(indicator).toEqual({ left: 7, top: 8, width: 24, height: INDICATOR_THICKNESS })
  })
})

describe('computeListDrop 落点', () => {
  it('容器内插到第二个节点之前时给出 beforeId 与 inside 落点', () => {
    const result = computeListDrop({
      containerId: 'c1',
      childIds: ['a', 'b', 'c'],
      childRects: columnRects(),
      listRect: { left: 0, top: 0, width: 240, height: 200 },
      axis: 'y',
      pointer: { x: 100, y: 50 },
    })

    expect(result.index).toBe(1)
    expect(result.target).toMatchObject({
      parentId: 'c1',
      position: 'inside',
      index: 1,
      beforeId: 'b',
      targetId: 'c1',
    })
  })

  it('追加到末尾时 beforeId 为 undefined', () => {
    const result = computeListDrop({
      containerId: 'c1',
      childIds: ['a', 'b'],
      childRects: columnRects().slice(0, 2),
      listRect: { left: 0, top: 0, width: 240, height: 200 },
      axis: 'y',
      pointer: { x: 100, y: 500 },
    })

    expect(result.index).toBe(2)
    expect(result.target.position).toBe('inside')
    expect(result.target.beforeId).toBeUndefined()
  })

  it('根列表落点 position 为 root', () => {
    const result = computeListDrop({
      containerId: null,
      childIds: ['a'],
      childRects: columnRects().slice(0, 1),
      listRect: { left: 0, top: 0, width: 240, height: 200 },
      axis: 'y',
      pointer: { x: 100, y: 999 },
    })

    expect(result.target.parentId).toBeNull()
    expect(result.target.position).toBe('root')
    expect(result.index).toBe(1)
  })
})

describe('visibleIndexToSchemaIndex：可见索引 → schema 索引', () => {
  it('没有隐藏节点时是恒等映射', () => {
    const ids = ['a', 'b', 'c']
    expect(visibleIndexToSchemaIndex(ids, ids, 0)).toBe(0)
    expect(visibleIndexToSchemaIndex(ids, ids, 1)).toBe(1)
    expect(visibleIndexToSchemaIndex(ids, ids, 3)).toBe(3)
  })

  it('⚠️ 隐藏节点占着 schema 槽位时，索引要相应后移', () => {
    // schema: a, h(隐藏), b   —— 可见: a, b
    const full = ['a', 'h', 'b']
    const visible = ['a', 'b']

    // 插到最前
    expect(visibleIndexToSchemaIndex(full, visible, 0)).toBe(0)
    // 插到 a 之后 → schema 索引 1（正好落在隐藏节点 h 之前）
    expect(visibleIndexToSchemaIndex(full, visible, 1)).toBe(1)
    // 插到 b 之后 → schema 索引 3（追加到末尾）
    expect(visibleIndexToSchemaIndex(full, visible, 2)).toBe(3)
  })

  it('隐藏节点在末尾时，"追加"要落在它之前', () => {
    // schema: a, b, h(隐藏) —— 可见: a, b
    const full = ['a', 'b', 'h']
    const visible = ['a', 'b']
    expect(visibleIndexToSchemaIndex(full, visible, 2)).toBe(2)
  })

  it('隐藏节点在最前时，"插到最前"要落在它之后', () => {
    // schema: h(隐藏), a, b —— 可见: a, b
    const full = ['h', 'a', 'b']
    const visible = ['a', 'b']
    expect(visibleIndexToSchemaIndex(full, visible, 0)).toBe(1)
  })

  it('可见列表为空时原样返回', () => {
    expect(visibleIndexToSchemaIndex(['h1', 'h2'], [], 0)).toBe(0)
  })

  it('锚点不在 schema 列表里时回退为原索引', () => {
    expect(visibleIndexToSchemaIndex(['a', 'b'], ['x', 'y'], 1)).toBe(1)
  })
})
