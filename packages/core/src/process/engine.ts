import type { DataModelOperation, ProcessEdge, ProcessNode, ProcessSchema } from '@lowcode/schema'
import type { ExpressionContext, IExpressionEngine } from '../expression/engine'
import type { ProcessSnapshot, ProcessStatus } from './types'

export interface ProcessEngineOptions {
  schema: ProcessSchema
  expression: IExpressionEngine
  /** apiCall 节点：按 apiRef 调用外部 API */
  callApi?: (
    apiRef: string,
    input: Record<string, unknown>,
    context: ExpressionContext,
  ) => Promise<unknown> | unknown
  /** dataModel 节点：按 modelRef + operation 读写数据模型 */
  callDataModel?: (
    modelRef: string,
    operation: DataModelOperation,
    input: Record<string, unknown>,
    context: ExpressionContext,
  ) => Promise<unknown> | unknown
  /** 运行时用户上下文（$user） */
  user?: Record<string, unknown>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 流程引擎（纯 TS，解释执行 ProcessSchema）：
 * - 节点执行器：start / end / task / apiCall / dataModel / delay / condition（排他网关）
 * - 实例状态机：run →（遇到 task 暂停 waiting）→ completeTask 续跑 → completed
 * - 表达式上下文：$input / $output / $variables / $context / $user / $node
 */
export class ProcessEngine {
  readonly schema: ProcessSchema
  private readonly options: ProcessEngineOptions
  private status: ProcessStatus = 'idle'
  private current: string[] = []
  private input: Record<string, unknown> = {}
  private variables: Record<string, unknown> = {}
  private output: Record<string, unknown> = {}
  private pendingTaskId: string | null = null
  private error: string | undefined

  constructor(options: ProcessEngineOptions) {
    this.schema = options.schema
    this.options = options
    for (const variable of this.schema.spec.variables ?? []) {
      this.variables[variable.name] = variable.defaultValue
    }
  }

  getStatus(): ProcessStatus {
    return this.status
  }

  getCurrentNodeIds(): string[] {
    return [...this.current]
  }

  getVariables(): Record<string, unknown> {
    return { ...this.variables }
  }

  getOutput(): Record<string, unknown> {
    return { ...this.output }
  }

  snapshot(): ProcessSnapshot {
    return {
      status: this.status,
      currentNodeIds: [...this.current],
      input: { ...this.input },
      variables: { ...this.variables },
      output: { ...this.output },
      pendingTaskId: this.pendingTaskId ?? undefined,
      error: this.error,
    }
  }

  /** 从 start 节点开始执行，直到 completed / waiting / failed */
  async run(input: Record<string, unknown> = {}): Promise<ProcessSnapshot> {
    this.status = 'idle'
    this.current = []
    this.input = { ...input }
    this.output = {}
    this.pendingTaskId = null
    this.error = undefined

    const start = this.schema.spec.nodes.find((n) => n.type === 'start')
    if (!start) {
      this.status = 'failed'
      this.error = '流程缺少 start 节点'
      return this.snapshot()
    }
    this.status = 'running'
    await this.executeFrom(start.id)
    return this.snapshot()
  }

  /** 完成人工任务并续跑流程 */
  async completeTask(nodeId: string, result?: unknown): Promise<ProcessSnapshot> {
    if (this.status !== 'waiting' || this.pendingTaskId !== nodeId) {
      throw new Error(`任务不可完成: ${nodeId}`)
    }
    const node = this.getNode(nodeId)
    if (node?.output && result !== undefined) this.output[node.output] = result
    this.pendingTaskId = null
    this.status = 'running'
    const next = node ? this.firstNext(node) : undefined
    if (next) await this.executeFrom(next)
    else this.status = 'completed'
    return this.snapshot()
  }

  /** 终止流程 */
  terminate(reason?: string): ProcessSnapshot {
    this.status = 'terminated'
    this.current = []
    this.pendingTaskId = null
    this.error = reason
    return this.snapshot()
  }

  private getNode(id: string): ProcessNode | undefined {
    return this.schema.spec.nodes.find((n) => n.id === id)
  }

  private outgoingEdges(nodeId: string): ProcessEdge[] {
    return this.schema.spec.edges.filter((e) => e.from === nodeId)
  }

  private firstNext(node: ProcessNode): string | undefined {
    return this.outgoingEdges(node.id)[0]?.to
  }

  private async executeFrom(nodeId: string): Promise<void> {
    if (
      this.status === 'completed' ||
      this.status === 'terminated' ||
      this.status === 'failed'
    ) {
      return
    }
    const node = this.getNode(nodeId)
    if (!node) {
      this.status = 'failed'
      this.error = `节点不存在: ${nodeId}`
      return
    }
    this.current = [node.id]

    try {
      switch (node.type) {
        case 'start':
          await this.advance(node)
          return
        case 'end':
          this.status = 'completed'
          this.current = []
          return
        case 'task':
          // 人工任务：暂停，等待 completeTask
          this.status = 'waiting'
          this.pendingTaskId = node.id
          return
        case 'delay':
          await sleep(node.delayMs ?? 0)
          await this.advance(node)
          return
        case 'apiCall':
          await this.runApiCall(node)
          await this.advance(node)
          return
        case 'dataModel':
          await this.runDataModel(node)
          await this.advance(node)
          return
        case 'condition':
          await this.advanceCondition(node)
          return
      }
    } catch (error) {
      this.status = 'failed'
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  /** 普通节点沿第一条出边前进；无出边视为结束 */
  private async advance(node: ProcessNode): Promise<void> {
    const next = this.firstNext(node)
    if (next) await this.executeFrom(next)
    else {
      this.status = 'completed'
      this.current = []
    }
  }

  /** 排他网关：取第一条无表达式（默认）或表达式为真的出边 */
  private async advanceCondition(node: ProcessNode): Promise<void> {
    const edges = this.outgoingEdges(node.id)
    let target: string | undefined
    for (const edge of edges) {
      if (!edge.expression) {
        target = edge.to
        break
      }
      const result = this.options.expression.tryEvaluate<boolean>(
        edge.expression,
        this.buildExpressionContext(),
      )
      if (result.ok && result.value) {
        target = edge.to
        break
      }
    }
    if (!target) {
      this.status = 'failed'
      this.error = `条件网关无匹配分支: ${node.id}`
      return
    }
    await this.executeFrom(target)
  }

  private async runApiCall(node: ProcessNode): Promise<void> {
    if (!this.options.callApi) {
      throw new Error('流程需要 callApi 能力（apiCall 节点）')
    }
    const input = this.resolveInput(node.input)
    const result = await this.options.callApi(
      node.apiRef ?? '',
      input,
      this.buildExpressionContext(),
    )
    if (node.output) this.output[node.output] = result
  }

  private async runDataModel(node: ProcessNode): Promise<void> {
    if (!this.options.callDataModel) {
      throw new Error('流程需要 callDataModel 能力（dataModel 节点）')
    }
    const input = this.resolveInput(node.input)
    const result = await this.options.callDataModel(
      node.modelRef ?? '',
      node.operation ?? 'query',
      input,
      this.buildExpressionContext(),
    )
    if (node.output) this.output[node.output] = result
  }

  /** 入参中 $ 开头的字符串视为表达式求值，其余按字面量 */
  private resolveInput(input?: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input ?? {})) {
      out[key] = this.resolveValue(value)
    }
    return out
  }

  private resolveValue(value: unknown): unknown {
    if (typeof value === 'string' && value.startsWith('$')) {
      const result = this.options.expression.tryEvaluate(value, this.buildExpressionContext())
      return result.ok ? result.value : undefined
    }
    return value
  }

  /** 流程表达式上下文：$input / $output / $variables / $context / $user / $node */
  buildExpressionContext(): ExpressionContext {
    const node = this.current[0] ? this.getNode(this.current[0]) : undefined
    const nodeInfo = node ? { id: node.id, name: node.name, type: node.type } : {}
    const scopes = {
      input: this.input,
      output: this.output,
      variables: this.variables,
      user: this.options.user ?? {},
      node: nodeInfo,
    }
    return {
      ...scopes,
      context: { ...scopes },
      $input: scopes.input,
      $output: scopes.output,
      $variables: scopes.variables,
      $user: scopes.user,
      $node: scopes.node,
      $context: { ...scopes },
    }
  }
}
