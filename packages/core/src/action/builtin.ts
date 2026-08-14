import type { Action } from './registry'

/**
 * 平台内置动作：按标准 ActionType（UnifiedEventAction.type）注册，
 * 同时通过 aliases 保留旧版 kind（setProp/setVariable/emitEvent/request）的兼容。
 * 全部通过 ActionContext 回调消费运行时能力，因此 Core 不依赖任何 UI 框架。
 */
export function createBuiltinActions(): Action[] {
  return [
    {
      kind: 'navigate',
      label: '页面跳转',
      execute: (ctx, config) => {
        const route = String(config.route ?? config.path ?? config.target ?? '')
        if (!route) return { ok: false, error: '缺少 route' }
        ctx.navigate?.(route)
        return { ok: true }
      },
    },
    {
      kind: 'openDialog',
      label: '打开弹窗',
      execute: (ctx, config) => {
        const dialogId = String(config.dialogId ?? config.id ?? config.target ?? '')
        if (!dialogId) return { ok: false, error: '缺少 dialogId' }
        ctx.openDialog?.(dialogId, config.payload)
        return { ok: true }
      },
    },
    {
      kind: 'closeDialog',
      label: '关闭弹窗',
      execute: (ctx, config) => {
        const dialogId = String(config.dialogId ?? config.id ?? config.target ?? '')
        ctx.closeDialog?.(dialogId)
        return { ok: true }
      },
    },
    {
      kind: 'dispatchEvent',
      aliases: ['emitEvent'],
      label: '派发事件',
      execute: (ctx, config) => {
        ctx.emit?.(
          String(config.event ?? config.eventName ?? config.target ?? ''),
          config.payload,
        )
        return { ok: true }
      },
    },
    {
      kind: 'invokeAPI',
      aliases: ['request'],
      label: '请求数据',
      execute: async (ctx, config) => {
        const dataSourceId = config.dataSourceId ?? config.target
        if (dataSourceId) {
          const manager = ctx.datasource
          if (!manager) return { ok: false, error: '缺少 DataSourceManager' }
          const data = await manager.load(
            String(dataSourceId),
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
      kind: 'setState',
      aliases: ['setProp', 'setVariable'],
      label: '更新组件/页面状态',
      execute: (ctx, config) => {
        let value: unknown = config.value
        if (typeof config.expression === 'string') {
          const result = ctx.expression.tryEvaluate(
            config.expression,
            ctx.expressionContext ?? {},
          )
          if (!result.ok) return { ok: false, error: `表达式求值失败: ${result.error}` }
          value = result.value
        }
        // prop 存在 → 更新节点属性（兼容旧 setProp）；否则 → 更新变量（兼容旧 setVariable）
        if (config.prop !== undefined) {
          const nodeId = String(config.nodeId ?? ctx.nodeId ?? '')
          ctx.setNodeProp?.(nodeId, String(config.prop), value)
          return { ok: true }
        }
        const name = String(config.name ?? config.target ?? '')
        if (!name) return { ok: false, error: '缺少变量名' }
        ctx.setVariable?.(name, value)
        return { ok: true }
      },
    },
    {
      kind: 'submit',
      label: '提交表单',
      execute: (ctx, config) => {
        const formId = String(config.formId ?? config.target ?? '')
        if (!formId) return { ok: false, error: '缺少 formId' }
        if (!ctx.submitForm) return { ok: false, error: '运行时未提供 submitForm 能力' }
        return ctx.submitForm(formId, config.payload)
      },
    },
    {
      kind: 'refresh',
      label: '刷新数据源',
      execute: async (ctx, config) => {
        const dataSourceId = String(config.dataSourceId ?? config.target ?? '')
        if (!dataSourceId) return { ok: false, error: '缺少 dataSourceId' }
        if (!ctx.datasource) return { ok: false, error: '运行时未提供 DataSourceManager' }
        const data = await ctx.datasource.load(dataSourceId)
        return { ok: true, value: data }
      },
    },
  ]
}
