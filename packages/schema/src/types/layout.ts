/** 网格位置 */
export interface LayoutPosition {
  x: number
  y: number
  w: number
  h: number
}

/** 页面布局模式 */
export interface Layout {
  mode: 'free' | 'grid'
  grid?: {
    columns: number
    rowHeight: number
    margin: number
  }
}
