import type { EventAction } from './event'

/** 规则触发时机 */
export type RuleTrigger = 'expression' | 'event' | 'datasource' | 'mount'

/** 联动规则：条件命中后执行动作链 */
export interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: RuleTrigger
  /** Jexl 条件表达式，例如 `$datasource.userList.data.length > 0` */
  condition: string
  actions: EventAction[]
  /** 防抖间隔（毫秒） */
  debounceMs?: number
  /** 依赖的其他规则 id，用于拓扑排序 */
  dependsOn?: string[]
}
