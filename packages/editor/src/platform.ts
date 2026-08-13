import {
  ActionRegistry,
  HookBus,
  JexlExpressionEngine,
  MaterialRegistry,
  PluginManager,
  createBuiltinActions,
  createPluginAPI,
  type IExpressionEngine,
  type Plugin,
} from '@lowcode/core'
import { registerLocalMaterials } from '@lowcode/materials'

/** 编辑器平台单例：物料注册表 / 动作注册表 / 表达式引擎 / 插件管理器 */
export const materialRegistry = new MaterialRegistry()
export const actionRegistry = new ActionRegistry()
export const expressionEngine: IExpressionEngine = new JexlExpressionEngine()

export const pluginManager = new PluginManager(
  createPluginAPI({
    actionRegistry,
    materialRegistry,
    expression: expressionEngine,
  }),
  new HookBus(),
)

let initialized = false

/** 初始化平台：注册本地物料与内置动作（幂等） */
export function initPlatform(): void {
  if (initialized) return
  initialized = true
  registerLocalMaterials(materialRegistry)
  actionRegistry.registerMany(createBuiltinActions())
}

/** 外部插件注册入口（playground 等） */
export function registerPlugin(plugin: Plugin): void {
  pluginManager.register(plugin)
}
