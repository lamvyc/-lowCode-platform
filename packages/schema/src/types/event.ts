/**
 * 动作类型：平台内置的最小动作集合
 * @deprecated 使用 STANDARD_ACTION_TYPES（P1 标准 Action 枚举）中的 ActionType。
 * 旧枚举通过 LEGACY_ACTION_TYPE_MAP 迁移：setProp/setVariable → setState、
 * emitEvent → dispatchEvent、request → invokeAPI、custom → dispatchEvent。
 */
export type ActionKind =
  | 'setProp'
  | 'setVariable'
  | 'openDialog'
  | 'closeDialog'
  | 'emitEvent'
  | 'request'
  | 'navigate'
  | 'custom'

/**
 * 事件动作：挂在节点事件上，由 EventEngine 按顺序执行。
 * children 用于条件分支，catch 用于错误处理。
 */
export interface EventAction {
  id: string
  /** @deprecated 迁移到 UnifiedEventAction.type */
  kind: ActionKind
  label?: string
  /** @deprecated 迁移到 UnifiedEventAction.params */
  config: Record<string, unknown>
  /** @deprecated 迁移到 UnifiedEventAction.expression */
  when?: string
  /**
   * @deprecated 动作链中的分支控制流（children/catch）移出声明层（P1），
   * 流程编排由 Process Schema 承担，错误处理由引擎统一兜底。
   */
  children?: EventAction[]
  /** @deprecated 见 children */
  catch?: EventAction[]
  /** @deprecated 见 children */
  continueOnError?: boolean
  /** 执行前延迟（毫秒） */
  delay?: number
}

/** @deprecated 旧版动作类型别名，迁移到 ActionType */
export type LegacyActionKind = ActionKind

/** @deprecated 旧版事件动作别名，迁移到 UnifiedEventAction */
export type LegacyEventAction = EventAction
