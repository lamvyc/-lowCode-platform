/** 设备视图类型 */
export type DeviceType = 'pc' | 'pad' | 'h5'

/** 设计器视图状态（非 schema 的 UI 状态） */
export interface DesignerViewState {
  selectedNodeId: string | null
  hoverNodeId: string | null
  device: DeviceType
  zoom: number
  preview: boolean
}
