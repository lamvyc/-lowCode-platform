import type { PageSchema } from '@lowcode/schema'
import type { IExpressionEngine, ExpressionContext } from '../expression/engine'
import type { DataSourceManager } from '../datasource/manager'
import type { HttpRequestConfig } from '../datasource/manager'
import type { ActionRegistry } from './registry'

/**
 * 动作执行上下文：Runtime / Editor 提供能力，Action 只消费接口。
 * 通过回调注入，保证 Core 不依赖具体 UI 框架。
 */
export interface ActionContext {
  expression: IExpressionEngine
  /** 表达式求值上下文（运行时注入） */
  expressionContext?: ExpressionContext
  datasource?: DataSourceManager
  /** 读取运行时状态 */
  getState(): Record<string, unknown>
  /** 写入运行时状态 */
  setState(key: string, value: unknown): void
  navigate?(route: string): void | Promise<void>
  request?(config: HttpRequestConfig): Promise<unknown>
  openDialog?(id: string, payload?: unknown): void
  closeDialog?(id: string): void
  setNodeProp?(nodeId: string, prop: string, value: unknown): void
  setVariable?(name: string, value: unknown): void
  emit?(event: string, payload?: unknown): void
  /** 触发事件的节点 */
  nodeId?: string
  schema?: PageSchema
  /** 允许自定义动作调用其他动作 */
  actionRegistry?: ActionRegistry
  [key: string]: unknown
}

/** 动作执行结果 */
export interface ActionResult {
  ok: boolean
  error?: string
  value?: unknown
  skipped?: boolean
}

/** 动作链控制：支持中断 */
export interface ActionChainControl {
  aborted: boolean
  abort(reason?: string): void
  isAborted(): boolean
  getResult(): ActionResult[]
}
