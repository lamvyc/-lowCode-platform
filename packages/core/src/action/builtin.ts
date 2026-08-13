import type { Action } from './registry'

/**
 * 平台内置动作：全部通过 ActionContext 回调消费运行时能力，
 * 因此 Core 本身不依赖任何 UI 框架。
 */
export function createBuiltinActions(): Action[] {
  return [
    {
      kind: 'setProp',
      label: '设置属性',
      execute: (ctx, config) => {
        const nodeId = String(config.nodeId ?? ctx.nodeId ?? '')
        const prop = String(config.prop)
        let value: unknown = config.value
        if (typeof config.expression === 'string') {
          const result = ctx.expression.tryEvaluate(
            config.expression,
            ctx.expressionContext ?? {},
          )
          if (!result.ok) return { ok: false, error: `表达式求值失败: ${result.error}` }
          value = result.value
        }
        ctx.setNodeProp?.(nodeId, prop, value)
        return { ok: true }
      },
    },
    {
      kind: 'openDialog',
      label: '打开弹窗',
      execute: (ctx, config) => {
        const dialogId = String(config.dialogId ?? config.id ?? '')
        if (!dialogId) return { ok: false, error: '缺少 dialogId' }
        ctx.openDialog?.(dialogId, config.payload)
        return { ok: true }
      },
    },
    {
      kind: 'closeDialog',
      label: '关闭弹窗',
      execute: (ctx, config) => {
        const dialogId = String(config.dialogId ?? config.id ?? '')
        ctx.closeDialog?.(dialogId)
        return { ok: true }
      },
    },
    {
      kind: 'emitEvent',
      label: '派发事件',
      execute: (ctx, config) => {
        ctx.emit?.(String(config.event ?? config.eventName ?? ''), config.payload)
        return { ok: true }
      },
    },
    {
      kind: 'request',
      label: '请求数据',
      execute: async (ctx, config) => {
        if (config.dataSourceId) {
          const manager = ctx.datasource
          if (!manager) return { ok: false, error: '缺少 DataSourceManager' }
          const data = await manager.load(
            String(config.dataSourceId),
            config.params as Record<string, unknown> | undefined,
          )
          ctx.setState('requestResult', data)
          return { ok: true, value: data }
        }
        if (!ctx.request) return { ok: false, error: '运行时未提供 request 能力' }
        const data = await ctx.request({
          url: String(config.url ?? ''),
          method: config.method ? String(config.method) : 'GET',
          params: (config.params as Record<string, unknown> | undefined) ?? {},
          headers: (config.headers as Record<string, string> | undefined) ?? {},
        })
        ctx.setState('requestResult', data)
        return { ok: true, value: data }
      },
    },
    {
      kind: 'navigate',
      label: '页面跳转',
      execute: (ctx, config) => {
        const route = String(config.route ?? config.path ?? '')
        if (!route) return { ok: false, error: '缺少 route' }
        ctx.navigate?.(route)
        return { ok: true }
      },
    },
  ]
}
