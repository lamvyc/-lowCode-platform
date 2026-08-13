import type { InjectionKey } from 'vue'

export interface NodeRectInfo {
  left: number
  top: number
  width: number
  height: number
  depth: number
}

export interface NodeRectRegistry {
  register(id: string, rect: NodeRectInfo): void
  rects: Map<string, NodeRectInfo>
}

/** 画布节点把自身几何信息注册给画布（用于落点指示器定位） */
export const REGISTER_RECT_KEY: InjectionKey<NodeRectRegistry> =
  Symbol('lc.registerRect')
