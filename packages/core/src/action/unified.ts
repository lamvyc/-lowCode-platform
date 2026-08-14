import type { UnifiedEventAction } from '@lowcode/schema'
import type { ActionRegistry } from './registry'
import type { ActionContext, ActionResult, ActionChainControl } from './context'
import { formatActionSuggestion } from './suggest'

/**
 * 统一动作执行器：原生消费 2.x UnifiedEventAction（type/target/params/expression），
 * 按标准 ActionType 查注册表执行。与旧版 ActionChainRunner 的区别：
 * - 无 children/catch/continueOnError/delay（控制流已移出声明层，由流程编排承担）；
 * - 失败隔离：单个动作出错记录结果并继续，不中断整条链（与渲染/数据源的容错哲学一致）。
 */
export class UnifiedActionRunner {
  constructor(private registry: ActionRegistry) {}

  async run(actions: UnifiedEventAction[], context: ActionContext): Promise<ActionResult[]> {
    const results: ActionResult[] = []
    const control: ActionChainControl = {
      aborted: false,
      abort: (reason) => {
        control.aborted = true
        if (reason) results.push({ ok: false, error: reason })
      },
      isAborted: () => control.aborted,
      getResult: () => results,
    }

    for (const action of actions) {
      if (control.aborted) break

      // expression 为执行条件（守卫），求值为假则跳过
      if (action.expression) {
        const guard = context.expression.tryEvaluate(
          action.expression,
          context.expressionContext ?? {},
        )
        if (!guard.ok || !guard.value) {
          results.push({ ok: true, skipped: true })
          continue
        }
      }

      const impl = this.registry.get(action.type)
      if (!impl) {
        results.push({
          ok: false,
          error: `未知动作: ${action.type}${formatActionSuggestion(action.type, this.registry)}`,
        })
        continue
      }

      const config: Record<string, unknown> = { ...(action.params ?? {}) }
      if (action.target !== undefined) config.target = action.target

      try {
        results.push(await impl.execute(context, config, control))
      } catch (error) {
        results.push({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }
}
