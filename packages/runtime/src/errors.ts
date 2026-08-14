/** 错误作用域：渲染 / 表达式 / 数据源 / 动作 / 规则 / 事件 */
export type RuntimeErrorScope =
  | 'render'
  | 'expression'
  | 'datasource'
  | 'action'
  | 'rule'
  | 'event'

/** 运行时错误条目：记录错误上下文（E4） */
export interface RuntimeError {
  scope: RuntimeErrorScope
  message: string
  /** 关联节点（若有） */
  nodeId?: string
  /** 关联属性 / 数据源 / 动作名（若有） */
  ref?: string
  detail?: unknown
  at: number
}

/** 已上报 key 集合（模块级，避免类私有成员破坏结构类型匹配） */
const reportedKeys = new WeakMap<ErrorCollector, Set<string>>()

/**
 * 错误收集器：单个组件 / 表达式 / 数据源出错时记录上下文，
 * 不抛出、不阻断渲染（E4 容错降级）。同 key 错误只记一次，成功后允许再次记录。
 */
export class ErrorCollector {
  readonly items: RuntimeError[] = []
  onError?: (error: RuntimeError) => void

  add(entry: Omit<RuntimeError, 'at'>, key?: string): void {
    if (key) {
      const seen = reportedKeys.get(this) ?? new Set<string>()
      if (seen.has(key)) return
      seen.add(key)
      reportedKeys.set(this, seen)
    }
    const item: RuntimeError = { ...entry, at: Date.now() }
    this.items.push(item)
    this.onError?.(item)
  }

  /** 标记某 key 已恢复（错误消失），后续再次出错可重新记录 */
  resolve(key: string): void {
    reportedKeys.get(this)?.delete(key)
  }

  clear(): void {
    this.items.length = 0
    reportedKeys.delete(this)
  }
}
