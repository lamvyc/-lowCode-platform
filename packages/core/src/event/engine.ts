import type { EventAction, EventDispatchPayload } from '@lowcode/schema'
import type { PageSchema } from '@lowcode/schema'
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
  /**
   * 事件索引缓存：nodeId:eventName → 动作链。
   * schema 不可变引用（RuntimeContext 归一化后不再修改），按引用缓存可把
   * dispatch 从 O(节点数) 降到 O(事件数)。
   */
  private indexCache = new WeakMap<PageSchema, Map<string, EventAction[]>>()

  constructor(private options: { registry: ActionRegistry; expression?: unknown; timing?: (name: string, ms: number) => void }) {}

  async dispatch(
    eventName: string,
    payload: EventDispatchPayload,
    context: ActionContext,
  ): Promise<ActionResult[]> {
    const schema = context.schema
    if (!schema) return []
    const start = this.options.timing ? performance.now() : 0
    try {
      const actions = this.collect(schema, eventName, payload.nodeId)
      return await this.execute(actions, { ...context, ...payload })
    } finally {
      if (this.options.timing) this.options.timing('event.dispatch', performance.now() - start)
    }
  }

  async execute(actions: EventAction[], context: ActionContext): Promise<ActionResult[]> {
    return new ActionChainRunner(this.options.registry, context).run(actions)
  }

  /** 收集指定节点/事件的动作链；无 nodeId 时收集全页面匹配事件 */
  private collect(schema: PageSchema, eventName: string, nodeId?: string): EventAction[] {
    let index = this.indexCache.get(schema)
    if (!index) {
      index = new Map<string, EventAction[]>()
      for (const node of schema.nodes) {
        for (const [name, actions] of Object.entries(node.events ?? {})) {
          index.set(`${node.id}:${name}`, actions)
        }
      }
      this.indexCache.set(schema, index)
    }
    if (nodeId) return index.get(`${nodeId}:${eventName}`) ?? []
    const actions: EventAction[] = []
    for (const node of schema.nodes) {
      actions.push(...(index.get(`${node.id}:${eventName}`) ?? []))
    }
    return actions
  }
}
