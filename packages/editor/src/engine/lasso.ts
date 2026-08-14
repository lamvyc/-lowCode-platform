export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

export function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  )
}

export function collectLassoHits(
  rects: Array<[string, RectLike]>,
  lasso: RectLike,
): string[] {
  return rects.filter(([, rect]) => rectsIntersect(rect, lasso)).map(([id]) => id)
}
