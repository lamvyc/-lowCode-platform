import type { EventAction } from '@lowcode/schema'
import type { ActionContext, ActionResult, ActionChainControl } from './context'
import type { ActionRegistry } from './registry'
import { formatActionSuggestion } from './suggest'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 动作链执行器：
 * - 串行执行
 * - when 条件跳过
 * - children 条件分支
 * - catch 错误处理
 * - continueOnError 决定出错后是否继续
 * - delay 延迟执行
 */
export class ActionChainRunner {
  constructor(private registry: ActionRegistry, private ctx: ActionContext) {}

  async run(actions: EventAction[]): Promise<ActionResult[]> {
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

    for (const eventAction of actions) {
      if (control.aborted) break

      if (eventAction.when) {
        const when = this.ctx.expression.tryEvaluate(
          eventAction.when,
          this.ctx.expressionContext ?? {},
        )
        if (!when.ok || !when.value) {
          results.push({ ok: true, skipped: true })
          continue
        }
      }

      if (eventAction.delay && eventAction.delay > 0) {
        await sleep(eventAction.delay)
      }

      // 条件分支：有 children 时执行子链，替代本动作
      if (eventAction.children && eventAction.children.length > 0) {
        results.push(...(await this.run(eventAction.children)))
        continue
      }

      // custom 动作通过 config.actionId 查找
      const actionKey =
        eventAction.kind === 'custom'
          ? String(eventAction.config.actionId ?? 'custom')
          : eventAction.kind
      const action = this.registry.get(actionKey)
      if (!action) {
        const failure: ActionResult = {
          ok: false,
          error: `未知动作: ${actionKey}${formatActionSuggestion(actionKey, this.registry)}`,
        }
        results.push(failure)
        if (!eventAction.continueOnError) control.abort()
        continue
      }

      try {
        const result = await action.execute(this.ctx, eventAction.config, control)
        results.push(result)
        if (!result.ok) {
          if (eventAction.catch && eventAction.catch.length > 0) {
            results.push(...(await this.run(eventAction.catch)))
          }
          if (!eventAction.continueOnError) control.abort(result.error ?? '动作执行失败')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({ ok: false, error: message })
        if (eventAction.catch && eventAction.catch.length > 0) {
          results.push(...(await this.run(eventAction.catch)))
        }
        if (!eventAction.continueOnError) control.abort(message)
      }
    }

    return results
  }
}
