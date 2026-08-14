import type { Rule } from '@lowcode/schema'
import type { IExpressionEngine, ExpressionContext } from '../expression/engine'
import type { ActionContext, ActionResult } from '../action/context'
import type { ActionRegistry } from '../action/registry'
import { ActionChainRunner } from '../action/chain'

/** 防抖时间戳表（模块级，避免类私有成员破坏结构类型匹配） */
const lastRuns = new WeakMap<RuleEngine, Map<string, number>>()

export interface RuleEngineOptions {
  expression: IExpressionEngine
  actionRegistry?: ActionRegistry
  /** 每次 run 的耗时回调（性能可观测，E5） */
  timing?: (name: string, ms: number) => void
}

export interface RuleRunResult {
  rule: Rule
  matched: boolean
  results?: ActionResult[]
  skipped?: string
}

/**
 * 规则引擎：根据条件表达式决定是否执行动作链。
 * 支持防抖、依赖拓扑排序与循环依赖保护。
 */
export class RuleEngine {
  readonly options: RuleEngineOptions

  constructor(options: RuleEngineOptions) {
    this.options = options
  }

  /** 求值单条规则条件 */
  evaluate(rule: Rule, context: ExpressionContext): boolean {
    // condition 为 1.x 旧字段，统一 Schema（P3）使用 expression；运行时兼容读取
    const expression = rule.expression ?? rule.condition
    const result = this.options.expression.tryEvaluate<boolean>(expression, context)
    return result.ok && Boolean(result.value)
  }

  async run(
    rules: Rule[],
    expressionContext: ExpressionContext,
    actionContext: ActionContext,
  ): Promise<RuleRunResult[]> {
    const start = this.options.timing ? performance.now() : 0
    try {
      const enabled = rules.filter((rule) => rule.enabled)
      const ordered = topologicalSort(enabled)
      const results: RuleRunResult[] = []

      for (const rule of ordered) {
        if (rule.debounceMs) {
          const last = (lastRuns.get(this) ?? new Map()).get(rule.id)
          if (last !== undefined && Date.now() - last < rule.debounceMs) {
            results.push({ rule, matched: false, skipped: 'debounce' })
            continue
          }
        }

        const matched = this.evaluate(rule, expressionContext)
        if (!matched) {
          results.push({ rule, matched: false })
          continue
        }

        const runMap = lastRuns.get(this) ?? new Map<string, number>()
        runMap.set(rule.id, Date.now())
        lastRuns.set(this, runMap)
        let actionResults: ActionResult[] | undefined
        if (this.options.actionRegistry) {
          actionResults = await new ActionChainRunner(
            this.options.actionRegistry,
            actionContext,
          ).run(rule.actions)
        }
        results.push({ rule, matched: true, results: actionResults })
      }
      return results
    } finally {
      if (this.options.timing) this.options.timing('rules.run', performance.now() - start)
    }
  }
}

/** Kahn 拓扑排序：依赖有环时把环内规则按原顺序追加，避免死循环 */
function topologicalSort(rules: Rule[]): Rule[] {
  const byId = new Map(rules.map((rule) => [rule.id, rule]))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const rule of rules) {
    const deps = (rule.dependsOn ?? []).filter((dep) => byId.has(dep))
    indegree.set(rule.id, deps.length)
    for (const dep of deps) {
      if (!dependents.has(dep)) dependents.set(dep, [])
      dependents.get(dep)!.push(rule.id)
    }
  }

  const queue = rules.filter((rule) => (indegree.get(rule.id) ?? 0) === 0)
  const ordered: Rule[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const rule = queue.shift()!
    if (visited.has(rule.id)) continue
    visited.add(rule.id)
    ordered.push(rule)
    for (const dep of dependents.get(rule.id) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 0) - 1)
      if (indegree.get(dep) === 0) {
        const next = byId.get(dep)
        if (next) queue.push(next)
      }
    }
  }

  for (const rule of rules) {
    if (!visited.has(rule.id)) ordered.push(rule)
  }
  return ordered
}
