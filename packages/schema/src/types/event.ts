/** 动作类型：平台内置的最小动作集合 */
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
  kind: ActionKind
  label?: string
  /** 动作参数，由具体 Action 实现解释 */
  config: Record<string, unknown>
  /** 可选条件表达式，为假时跳过本动作（串行继续） */
  when?: string
  /** 子动作：条件为真时进入子链 */
  children?: EventAction[]
  /** 出错时执行的动作 */
  catch?: EventAction[]
  /** 出错后是否继续后续动作 */
  continueOnError?: boolean
  /** 执行前延迟（毫秒） */
  delay?: number
}
