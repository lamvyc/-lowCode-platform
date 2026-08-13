import type { ActionContext, ActionResult } from './context'

/** 动作定义：kind 为注册键，execute 实现具体行为 */
export interface Action {
  kind: string
  label?: string
  execute(
    ctx: ActionContext,
    config: Record<string, unknown>,
    chain: import('./context').ActionChainControl,
  ): ActionResult | Promise<ActionResult>
}

/** 动作注册表：Core 不写死动作集合，插件可扩展 */
export class ActionRegistry {
  private actions = new Map<string, Action>()

  register(action: Action): void {
    if (this.actions.has(action.kind)) {
      throw new Error(`动作已注册: ${action.kind}`)
    }
    this.actions.set(action.kind, action)
  }

  registerMany(actions: Action[]): void {
    for (const action of actions) this.register(action)
  }

  get(kind: string): Action | undefined {
    return this.actions.get(kind)
  }

  has(kind: string): boolean {
    return this.actions.has(kind)
  }

  list(): Action[] {
    return [...this.actions.values()]
  }
}
