import {
  ActionRegistry,
  HookBus,
  JexlExpressionEngine,
  MaterialRegistry,
  PluginManager,
  RemoteMaterialLoader,
  createBuiltinActions,
  createPluginAPI,
  type IExpressionEngine,
  type Plugin,
} from '@lowcode/core'
import { defineComponent, h } from 'vue'
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

/** 远程物料加载器：ESM 用动态 import，UMD 用 script 注入 */
export const remoteMaterialLoader = new RemoteMaterialLoader({
  registry: materialRegistry,
  storage:
    typeof window !== 'undefined' ? window.localStorage : undefined,
  loadEsm: (url) =>
    import(/* @vite-ignore */ url).then(
      (module) => module as Record<string, unknown>,
    ),
  loadUmd: (url, globalName) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        const global = globalName
          ? (window as unknown as Record<string, unknown>)[globalName]
          : undefined
        if (global) resolve({ default: global })
        else reject(new Error(`UMD 全局对象 ${globalName ?? '(未指定)'} 不存在`))
      }
      script.onerror = () => reject(new Error(`UMD 脚本加载失败: ${url}`))
      document.head.appendChild(script)
    }),
  fallback: () =>
    defineComponent({
      name: 'RemoteMaterialFallback',
      render: () =>
        h(
          'div',
          {
            style: {
              border: '1px dashed #f53f3f',
              color: '#f53f3f',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
            },
          },
          '远程物料加载失败',
        ),
    }),
})

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
