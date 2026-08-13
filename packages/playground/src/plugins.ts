import type { Plugin } from '@lowcode/core'

/** 示例插件：注册自定义动作 + 生命周期钩子 */
export const demoPlugin: Plugin = {
  id: 'demo-plugin',
  name: '示例插件',
  version: '1.0.0',
  setup(api) {
    api.registerAction({
      kind: 'greet',
      label: '打招呼',
      execute: () => ({ ok: true, value: '你好，这是插件注册的自定义动作' }),
    })
    api.addFunction('today', () => new Date().toLocaleDateString('zh-CN'))
  },
  hooks: {
    beforePageSave: (payload) => {
      console.log('[示例插件] beforePageSave', payload)
    },
  },
}
