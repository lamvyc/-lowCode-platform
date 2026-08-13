import { describe, expect, it, vi } from 'vitest'
import type { Plugin } from '@lowcode/core'
import {
  ActionRegistry,
  HookBus,
  JexlExpressionEngine,
  MaterialRegistry,
  PluginManager,
  createBuiltinActions,
  createPluginAPI,
} from '@lowcode/core'

describe('PluginManager 插件系统', () => {
  it('注册插件并执行生命周期钩子', async () => {
    const hooks = new HookBus()
    const api = createPluginAPI({
      actionRegistry: new ActionRegistry(),
      materialRegistry: new MaterialRegistry(),
      expression: new JexlExpressionEngine(),
    })
    const manager = new PluginManager(api, hooks)
    const beforeSave = vi.fn()
    manager.register({
      id: 'plugin-a',
      hooks: {
        beforePageSave: beforeSave,
      },
    })
    await manager.runHook('beforePageSave', { pageId: 'p1' })
    expect(beforeSave).toHaveBeenCalled()
    expect(manager.list()).toHaveLength(1)
  })

  it('重复注册同 id 插件抛错', () => {
    const manager = new PluginManager(
      createPluginAPI({
        actionRegistry: new ActionRegistry(),
        materialRegistry: new MaterialRegistry(),
        expression: new JexlExpressionEngine(),
      }),
      new HookBus(),
    )
    const plugin: Plugin = { id: 'p', setup: () => {} }
    manager.register(plugin)
    expect(() => manager.register(plugin)).toThrow()
  })

  it('插件可通过 setup 注册自定义动作', async () => {
    const actionRegistry = new ActionRegistry()
    actionRegistry.registerMany(createBuiltinActions())
    const api = createPluginAPI({
      actionRegistry,
      materialRegistry: new MaterialRegistry(),
      expression: new JexlExpressionEngine(),
    })
    const manager = new PluginManager(api, new HookBus())
    manager.register({
      id: 'plugin-action',
      setup(pluginApi) {
        pluginApi.registerAction({
          kind: 'hello',
          execute: () => ({ ok: true, value: 'hello' }),
        })
      },
    })
    const action = actionRegistry.get('hello')
    expect(action).toBeDefined()
    const result = await action?.execute(
      {
        expression: new JexlExpressionEngine(),
        getState: () => ({}),
        setState: () => {},
      },
      {},
      { aborted: false, abort: () => {}, isAborted: () => false, getResult: () => [] },
    )
    expect(result?.value).toBe('hello')
  })
})
