import type { Material } from '@lowcode/schema'
import type { IExpressionEngine } from '../expression/engine'
import type { Action } from '../action/registry'
import type { ActionRegistry } from '../action/registry'
import type { MaterialRegistry } from '../material/registry'
import { DataBus } from '../data-bus'
import { HookBus, type HookHandler, type PluginHookName } from './hooks'

/** 插件可用的平台 API */
export interface PluginAPI {
  actionRegistry: ActionRegistry
  materialRegistry: MaterialRegistry
  expression: IExpressionEngine
  bus: DataBus
  registerAction(action: Action): void
  registerMaterial(material: Material): void
  addFunction(name: string, fn: (...args: unknown[]) => unknown): void
  emit(event: string, payload?: unknown): void
}

export interface Plugin {
  id: string
  name?: string
  version?: string
  setup?(api: PluginAPI): void
  hooks?: Partial<Record<PluginHookName, HookHandler>>
}

export function createPluginAPI(deps: {
  actionRegistry: ActionRegistry
  materialRegistry: MaterialRegistry
  expression: IExpressionEngine
  bus?: DataBus
}): PluginAPI {
  const bus = deps.bus ?? new DataBus()
  return {
    actionRegistry: deps.actionRegistry,
    materialRegistry: deps.materialRegistry,
    expression: deps.expression,
    bus,
    registerAction: (action) => deps.actionRegistry.register(action),
    registerMaterial: (material) => deps.materialRegistry.register(material),
    addFunction: (name, fn) => deps.expression.addFunction(name, fn),
    emit: (event, payload) => bus.emit(event, payload),
  }
}

/**
 * 插件管理器：不修改 Core 源码即可扩展能力。
 * setup 注册动作/物料/函数，hooks 挂载生命周期钩子。
 */
export class PluginManager {
  private plugins = new Map<string, Plugin>()

  constructor(private api: PluginAPI, private hookBus: HookBus = new HookBus()) {}

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`插件已注册: ${plugin.id}`)
    }
    plugin.setup?.(this.api)
    for (const [name, handler] of Object.entries(plugin.hooks ?? {})) {
      if (!handler) continue
      this.hookBus.on(name as PluginHookName, (payload) => handler(payload, this.api))
    }
    this.plugins.set(plugin.id, plugin)
  }

  get(id: string): Plugin | undefined {
    return this.plugins.get(id)
  }

  list(): Plugin[] {
    return [...this.plugins.values()]
  }

  async runHook(name: PluginHookName, payload?: unknown): Promise<void> {
    await this.hookBus.emit(name, payload)
  }

  get hooks(): HookBus {
    return this.hookBus
  }
}
