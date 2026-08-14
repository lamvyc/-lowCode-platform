import { describe, expect, it, vi } from 'vitest'
import type { ActionContext } from '@lowcode/core'
import type { UnifiedEventAction } from '@lowcode/schema'
import {
  ActionRegistry,
  DataSourceManager,
  JexlExpressionEngine,
  UnifiedActionRunner,
  createBuiltinActions,
} from '@lowcode/core'

function createContext(overrides: Partial<ActionContext> = {}): ActionContext {
  const state: Record<string, unknown> = {}
  return {
    expression: new JexlExpressionEngine(),
    getState: () => state,
    setState: (key, value) => {
      state[key] = value
    },
    setNodeProp: (nodeId, prop, value) => {
      state[`${nodeId}.${prop}`] = value
    },
    setVariable: (name, value) => {
      state[name] = value
    },
    ...overrides,
  }
}

function makeRegistry(): ActionRegistry {
  const registry = new ActionRegistry()
  registry.registerMany(createBuiltinActions())
  return registry
}

describe('UnifiedActionRunner 统一动作执行器', () => {
  it('setState 携带 nodeId+prop 时更新节点属性', async () => {
    const ctx = createContext()
    const actions: UnifiedEventAction[] = [
      { id: 'a1', type: 'setState', params: { nodeId: 'n1', prop: 'text', value: '你好' } },
    ]
    const results = await new UnifiedActionRunner(makeRegistry()).run(actions, ctx)
    expect(results[0]?.ok).toBe(true)
    expect(ctx.getState()['n1.text']).toBe('你好')
  })

  it('setState 携带 name 时更新页面变量', async () => {
    const ctx = createContext()
    const actions: UnifiedEventAction[] = [
      { id: 'a1', type: 'setState', target: 'keyword', params: { value: '搜索' } },
    ]
    await new UnifiedActionRunner(makeRegistry()).run(actions, ctx)
    expect(ctx.getState()['keyword']).toBe('搜索')
  })

  it('refresh 刷新指定数据源', async () => {
    const datasource = new DataSourceManager({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
    datasource.register({ id: 'ds1', name: '静态', type: 'static', config: { staticData: [1, 2] } })
    const loadSpy = vi.spyOn(datasource, 'load')
    const ctx = createContext({ datasource })
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [{ id: 'a1', type: 'refresh', target: 'ds1' }],
      ctx,
    )
    expect(results[0]?.ok).toBe(true)
    expect(loadSpy).toHaveBeenCalledWith('ds1')
  })

  it('submit 委托给运行时 submitForm 能力', async () => {
    const submitForm = vi.fn().mockResolvedValue({ ok: true })
    const ctx = createContext({ submitForm })
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [{ id: 'a1', type: 'submit', target: 'form1', params: { payload: { a: 1 } } }],
      ctx,
    )
    expect(results[0]?.ok).toBe(true)
    expect(submitForm).toHaveBeenCalledWith('form1', { a: 1 })
  })

  it('submit 缺少运行时能力时返回错误', async () => {
    const ctx = createContext()
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [{ id: 'a1', type: 'submit', target: 'form1' }],
      ctx,
    )
    expect(results[0]?.ok).toBe(false)
  })

  it('expression 守卫为假时跳过动作', async () => {
    const ctx = createContext()
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [{ id: 'a1', type: 'setState', target: 'x', params: { value: 1 }, expression: 'false' }],
      ctx,
    )
    expect(results[0]).toEqual({ ok: true, skipped: true })
    expect(ctx.getState()['x']).toBeUndefined()
  })

  it('未知动作记录错误并继续后续动作（失败隔离）', async () => {
    const ctx = createContext()
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [
        { id: 'a1', type: 'unknown' },
        { id: 'a2', type: 'setState', target: 'x', params: { value: 2 } },
      ],
      ctx,
    )
    expect(results[0]?.ok).toBe(false)
    expect(results[1]?.ok).toBe(true)
    expect(ctx.getState()['x']).toBe(2)
  })

  it('未知动作错误信息附带拼写建议', async () => {
    const ctx = createContext()
    const results = await new UnifiedActionRunner(makeRegistry()).run(
      [{ id: 'a1', type: 'setstate' }],
      ctx,
    )
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.error).toContain('setState')
  })

  it('动作抛出异常时记录错误并继续', async () => {
    const registry = makeRegistry()
    registry.register({
      kind: 'boom',
      execute: () => {
        throw new Error('爆炸')
      },
    })
    const ctx = createContext()
    const results = await new UnifiedActionRunner(registry).run(
      [
        { id: 'a1', type: 'boom' },
        { id: 'a2', type: 'setState', target: 'x', params: { value: 3 } },
      ],
      ctx,
    )
    expect(results[0]?.ok).toBe(false)
    expect(ctx.getState()['x']).toBe(3)
  })

  it('插件注册的自定义动作通过 type 直接执行', async () => {
    const registry = makeRegistry()
    registry.register({
      kind: 'myPluginAction',
      execute: (ctx, config) => {
        ctx.setState('pluginCalled', config.value)
        return { ok: true }
      },
    })
    const ctx = createContext()
    const results = await new UnifiedActionRunner(registry).run(
      [{ id: 'a1', type: 'myPluginAction', params: { value: 42 } }],
      ctx,
    )
    expect(results[0]?.ok).toBe(true)
    expect(ctx.getState()['pluginCalled']).toBe(42)
  })
})

describe('createBuiltinActions 标准 type 注册 + 旧版别名', () => {
  it('旧版 kind 通过别名解析到同一动作', () => {
    const registry = makeRegistry()
    expect(registry.get('setProp')).toBe(registry.get('setState'))
    expect(registry.get('setVariable')).toBe(registry.get('setState'))
    expect(registry.get('emitEvent')).toBe(registry.get('dispatchEvent'))
    expect(registry.get('request')).toBe(registry.get('invokeAPI'))
  })

  it('submit / refresh 已作为一等动作注册', () => {
    const registry = makeRegistry()
    expect(registry.has('submit')).toBe(true)
    expect(registry.has('refresh')).toBe(true)
  })
})
