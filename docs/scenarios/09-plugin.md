# 场景 9：插件扩展

## 1. 场景

不修改 Core 源码，新增一个自定义 Action，并在页面保存前挂一个钩子。

## 2. 最终效果

插件注册的 `greet` 动作可被动作链调用；`beforePageSave` 钩子在每次保存时自动执行。

## 3. 完整链路

```text
Plugin.setup(api)
  → api.registerAction({ kind: 'greet' })
  → ActionRegistry 增加动作
  → EventEngine 发现 custom 动作（config.actionId='greet'）
  → ActionChainRunner 执行插件动作

保存页面 → PluginManager.runHook('beforePageSave') → 插件钩子执行
```

## 4. 核心数据结构

```ts
interface Plugin {
  id: string
  setup?(api: PluginAPI): void
  hooks?: Partial<Record<PluginHookName, HookHandler>>
}

interface PluginAPI {
  registerAction(action): void
  registerMaterial(material): void
  addFunction(name, fn): void
  emit(event, payload?): void
}
```

## 5. 核心接口

```ts
class PluginManager {
  register(plugin): void
  runHook(name, payload?): Promise<void>
}
```

## 6. 工业实现

平台暴露 `PluginAPI`（动作注册表 / 物料注册表 / 表达式引擎 / 事件总线），插件通过 setup 扩展能力；HookBus 管理 9 个生命周期钩子（onEngineInit / onEditorInit / onMaterialRegister / beforeNodeMount / afterNodeMount / beforePropsChange / afterPropsChange / beforePageSave / afterPageSave）。重复注册同 id 插件会抛错。

## 7. 关键代码

```ts
register(plugin) {
  if (this.plugins.has(plugin.id)) throw new Error(`插件已注册: ${plugin.id}`)
  plugin.setup?.(this.api)
  for (const [name, handler] of Object.entries(plugin.hooks ?? {})) {
    this.hookBus.on(name, (payload) => handler(payload, this.api))
  }
  this.plugins.set(plugin.id, plugin)
}
```

## 8. 调用链

```text
register → setup → registerAction → 动作进入 Registry → 事件触发 → 执行
```

## 9. 数据流

```text
插件声明 → PluginAPI → Registry / HookBus → Core 调用点 → 插件逻辑
```

## 10. 状态变化

- ActionRegistry / MaterialRegistry 增加条目；HookBus 增加监听器。

## 11. 模块协作

插件系统让 Core 保持「封闭修改、开放扩展」：Core 定义接口和调用点，插件提供实现。业务团队可以按产品域开发独立插件，互不干扰。

## 12. 扩展点

- 新钩子：在 `PluginHookName` 增加名称并在平台调用点 `runHook`。
- 新能力：在 PluginAPI 中增加注册方法。

## 13. 面试表达

> 插件系统把「能力注入」和「生命周期通知」两个机制分开：setup 注入注册表能力，HookBus 在关键节点通知插件。这样 Core 不需要知道任何具体业务，新能力通过插件注册进注册表，动作链和渲染器在运行时自然发现它们。
