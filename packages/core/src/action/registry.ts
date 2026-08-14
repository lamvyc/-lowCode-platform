import type { ActionContext, ActionResult } from './context'

/** 动作定义：kind 为注册键（标准 ActionType），aliases 为兼容旧版 kind 的别名 */
export interface Action {
  kind: string
  /** 旧版 kind 别名（如 setProp/setVariable → setState、request → invokeAPI） */
  aliases?: string[]
  label?: string
  execute(
    ctx: ActionContext,
    config: Record<string, unknown>,
    chain: import('./context').ActionChainControl,
  ): ActionResult | Promise<ActionResult>
}

/** 动作注册表：Core 不写死动作集合，插件可扩展 */
export class ActionRegistry {
  /** 已注册动作表 */
  readonly actions = new Map<string, Action>()

  register(action: Action): void {
    const keys = [action.kind, ...(action.aliases ?? [])]
    for (const key of keys) {
      if (this.actions.has(key)) {
        throw new Error(`动作已注册: ${key}`)
      }
    }
    for (const key of keys) {
      this.actions.set(key, action)
    }
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
