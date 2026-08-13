import type { EventAction, EventDispatchPayload } from '@lowcode/schema'
import type { ActionContext, ActionResult } from '../action/context'
import type { ActionRegistry } from '../action/registry'
import { ActionChainRunner } from '../action/chain'

export interface IEventEngine {
  dispatch(
    eventName: string,
    payload: EventDispatchPayload,
    context: ActionContext,
  ): Promise<ActionResult[]>
  execute(actions: EventAction[], context: ActionContext): Promise<ActionResult[]>
}

/**
 * 事件引擎：收集 schema 中声明的事件动作并执行。
 * 运行时节点把 DOM 事件转成 eventName，引擎负责把事件映射到动作链。
 */
export class EventEngine implements IEventEngine {
  constructor(private options: { registry: ActionRegistry; expression?: unknown }) {}

  async dispatch(
    eventName: string,
    payload: EventDispatchPayload,
    context: ActionContext,
  ): Promise<ActionResult[]> {
    const schema = context.schema
    if (!schema) return []
    const actions: EventAction[] = []
    for (const node of schema.nodes) {
      if (payload.nodeId && node.id !== payload.nodeId) continue
      const nodeActions = node.events?.[eventName]
      if (nodeActions) actions.push(...nodeActions)
    }
    return this.execute(actions, { ...context, ...payload })
  }

  async execute(actions: EventAction[], context: ActionContext): Promise<ActionResult[]> {
    return new ActionChainRunner(this.options.registry, context).run(actions)
  }
}
