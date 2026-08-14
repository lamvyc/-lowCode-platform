import { describe, expect, it } from 'vitest'
import { collectLassoHits, rectsIntersect } from './lasso'

describe('lasso', () => {
  it('rectsIntersect 判断两个矩形是否相交', () => {
    expect(
      rectsIntersect(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 5, top: 5, width: 10, height: 10 },
      ),
    ).toBe(true)
    expect(
      rectsIntersect(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 11, top: 11, width: 10, height: 10 },
      ),
    ).toBe(false)
  })

  it('collectLassoHits 返回与框选区域相交的节点 id', () => {
    const rects: Array<[string, { left: number; top: number; width: number; height: number }]> = [
      ['a', { left: 0, top: 0, width: 20, height: 20 }],
      ['b', { left: 100, top: 100, width: 20, height: 20 }],
    ]

    expect(
      collectLassoHits(rects, { left: -10, top: -10, width: 40, height: 40 }),
    ).toEqual(['a'])
  })
})
