import type { PluginAPI } from './manager'

/** 插件生命周期钩子名称 */
export type PluginHookName =
  | 'onEngineInit'
  | 'onEditorInit'
  | 'onMaterialRegister'
  | 'beforeNodeMount'
  | 'afterNodeMount'
  | 'beforePropsChange'
  | 'afterPropsChange'
  | 'beforePageSave'
  | 'afterPageSave'

/** 钩子处理函数：payload 为钩子载荷，api 为平台能力 */
export type HookHandler = (payload: unknown, api: PluginAPI) => void | Promise<void>

/** HookBus 内部只负责传递载荷，api 由 PluginManager 闭包注入 */
type RawHookHandler = (payload: unknown) => void | Promise<void>

/** 钩子总线：插件在钩子上挂监听，平台在关键节点触发 */
export class HookBus {
  private handlers = new Map<PluginHookName, Set<RawHookHandler>>()

  on(name: PluginHookName, handler: RawHookHandler): () => void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set())
    }
    this.handlers.get(name)!.add(handler)
    return () => this.off(name, handler)
  }

  off(name: PluginHookName, handler: RawHookHandler): void {
    this.handlers.get(name)?.delete(handler)
  }

  async emit(name: PluginHookName, payload?: unknown): Promise<void> {
    const set = this.handlers.get(name)
    if (!set) return
    for (const handler of [...set]) {
      await handler(payload)
    }
  }

  has(name: PluginHookName): boolean {
    return (this.handlers.get(name)?.size ?? 0) > 0
  }
}
