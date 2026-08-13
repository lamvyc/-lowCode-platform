import type { Binding } from './binding'
import type { EventAction } from './event'

/** v-for 循环绑定配置 */
export interface LoopConfig {
  /** 数据来源表达式，例如 `$datasource.userList.data` */
  source: string
  /** 循环项变量名，例如 `item` */
  itemName: string
  /** 循环索引变量名，例如 `index` */
  indexName?: string
}

/** 节点级绑定：visible 控制显隐，loop 控制循环 */
export interface NodeBindings {
  visible?: Binding<boolean>
  loop?: Binding<LoopConfig>
}

/** 节点事件表：事件名 → 动作链 */
export interface NodeEvents {
  [eventName: string]: EventAction[]
}

/** 节点样式：每个 CSS 属性都可以静态或表达式绑定 */
export type StyleConfig = Record<string, Binding<string | number>>

/** 节点元信息：编辑器使用，不影响运行时渲染结果（hidden 除外） */
export interface NodeMeta {
  locked?: boolean
  hidden?: boolean
  label?: string
}

/**
 * 页面节点：保持轻量。
 * 节点只描述「是什么 + 有什么」，所有业务能力由 Core 各模块提供。
 */
export interface PageNode {
  id: string
  type: string
  props: Record<string, unknown>
  /** 子节点 id 列表（平铺存储，children 只存引用） */
  children?: string[]
  /** 具名插槽：插槽名 → 子节点 id 列表 */
  slots?: Record<string, string[]>
  bindings?: NodeBindings
  events?: NodeEvents
  style?: StyleConfig
  meta?: NodeMeta
}
