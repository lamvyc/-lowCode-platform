import type { DropTarget } from '@lowcode/core'
import type { DragState } from '../engine/types'

/** 设备视图类型 */
export type DeviceType = 'pc' | 'pad' | 'h5'

/** 设计器视图状态（非 schema 的 UI 状态） */
export interface DesignerViewState {
  selectedNodeId: string | null
  hoverNodeId: string | null
  device: DeviceType
  zoom: number
  preview: boolean
  /** 当前拖拽载荷（物料或画布节点） */
  dragState: DragState | null
  /** 拖拽过程中计算出的落点 */
  dropTarget: DropTarget | null
}
