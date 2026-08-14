/** 流程实例状态 */
export type ProcessStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'terminated'
  | 'failed'

/** 流程实例快照：run / completeTask / terminate 返回 */
export interface ProcessSnapshot {
  status: ProcessStatus
  /** 当前节点 id（waiting 时为人工任务节点；completed/terminated 时为空） */
  currentNodeIds: string[]
  input: Record<string, unknown>
  variables: Record<string, unknown>
  output: Record<string, unknown>
  /** waiting 状态下待处理的人工任务节点 id */
  pendingTaskId?: string
  /** failed/terminated 时的原因 */
  error?: string
}
