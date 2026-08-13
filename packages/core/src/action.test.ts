import { describe, expect, it } from 'vitest'
import type { ActionContext, EventAction } from '@lowcode/core'
import {
  ActionChainRunner,
  ActionRegistry,
  EventEngine,
  JexlExpressionEngine,
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
    ...overrides,
  }
}

describe('ActionChainRunner 动作链', () => {
  it('串行执行动作，结果按顺序返回', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const ctx = createContext()
    const actions: EventAction[] = [
      { id: 'a1', kind: 'setProp', config: { nodeId: 'n1', prop: 'text', value: '第一' } },
      { id: 'a2', kind: 'setProp', config: { nodeId: 'n1', prop: 'text', value: '第二' } },
    ]
    const results = await new ActionChainRunner(registry, ctx).run(actions)
    expect(results).toHaveLength(2)
    expect(ctx.getState()['n1.text']).toBe('第二')
  })

  it('when 条件为假时跳过动作', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const ctx = createContext()
    const actions: EventAction[] = [
      {
        id: 'a1',
        kind: 'setProp',
        when: 'false',
        config: { nodeId: 'n1', prop: 'text', value: '不该执行' },
      },
      { id: 'a2', kind: 'setProp', config: { nodeId: 'n1', prop: 'text', value: '执行' } },
    ]
    await new ActionChainRunner(registry, ctx).run(actions)
    expect(ctx.getState()['n1.text']).toBe('执行')
  })

  it('异步动作按顺序等待', async () => {
    const registry = new ActionRegistry()
    registry.register({
      kind: 'asyncAction',
      execute: async (ctx, config) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        ctx.setState('asyncDone', config.value)
        return { ok: true }
      },
    })
    const ctx = createContext()
    const results = await new ActionChainRunner(registry, ctx).run([
      { id: 'a1', kind: 'custom', config: { actionId: 'asyncAction', value: 42 } },
    ])
    expect(results[0]?.ok).toBe(true)
    expect(ctx.getState()['asyncDone']).toBe(42)
  })

  it('动作失败且无 catch 时中断后续动作', async () => {
    const registry = new ActionRegistry()
    registry.register({
      kind: 'boom',
      execute: () => ({ ok: false, error: '出错了' }),
    })
    const ctx = createContext()
    let executed = 0
    registry.register({
      kind: 'count',
      execute: () => {
        executed += 1
        return { ok: true }
      },
    })
    const results = await new ActionChainRunner(registry, ctx).run([
      { id: 'a1', kind: 'custom', config: { actionId: 'boom' } },
      { id: 'a2', kind: 'custom', config: { actionId: 'count' } },
    ])
    expect(results[0]?.ok).toBe(false)
    expect(executed).toBe(0)
  })

  it('continueOnError 为真时错误后继续', async () => {
    const registry = new ActionRegistry()
    registry.register({
      kind: 'boom',
      execute: () => ({ ok: false, error: '出错了' }),
    })
    const ctx = createContext()
    let executed = 0
    registry.register({
      kind: 'count',
      execute: () => {
        executed += 1
        return { ok: true }
      },
    })
    await new ActionChainRunner(registry, ctx).run([
      { id: 'a1', kind: 'custom', config: { actionId: 'boom' }, continueOnError: true },
      { id: 'a2', kind: 'custom', config: { actionId: 'count' } },
    ])
    expect(executed).toBe(1)
  })

  it('catch 子链在出错时执行', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    registry.register({
      kind: 'boom',
      execute: () => ({ ok: false, error: '出错了' }),
    })
    const ctx = createContext()
    const results = await new ActionChainRunner(registry, ctx).run([
      {
        id: 'a1',
        kind: 'custom',
        config: { actionId: 'boom' },
        catch: [
          { id: 'c1', kind: 'setProp', config: { nodeId: 'n1', prop: 'text', value: '兜底' } },
        ],
      },
    ])
    expect(ctx.getState()['n1.text']).toBe('兜底')
    expect(results.some((r) => r.ok === false)).toBe(true)
  })

  it('children 子链作为条件分支执行', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const ctx = createContext()
    await new ActionChainRunner(registry, ctx).run([
      {
        id: 'a1',
        kind: 'setProp',
        when: '1 === 1',
        config: {},
        children: [
          { id: 'c1', kind: 'setProp', config: { nodeId: 'n1', prop: 'text', value: '分支' } },
        ],
      },
    ])
    expect(ctx.getState()['n1.text']).toBe('分支')
  })

  it('未知动作返回错误结果', async () => {
    const registry = new ActionRegistry()
    const results = await new ActionChainRunner(registry, createContext()).run([
      { id: 'a1', kind: 'custom', config: { actionId: 'missing' } },
    ])
    expect(results[0]?.ok).toBe(false)
  })
})

describe('EventEngine 事件引擎', () => {
  it('dispatch 收集 schema 中节点事件并执行', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const ctx = createContext()
    const engine = new EventEngine({ registry, expression: ctx.expression })
    await engine.dispatch('click', { eventName: 'click' }, {
      ...ctx,
      schema: {
        version: '1.0.0',
        meta: {
          id: 'p1',
          name: 'p',
          createdAt: 'x',
          updatedAt: 'x',
        },
        nodes: [
          {
            id: 'n1',
            type: 'button',
            props: {},
            events: {
              click: [
                {
                  id: 'a1',
                  kind: 'setProp',
                  config: { nodeId: 'n1', prop: 'text', value: '已点击' },
                },
              ],
            },
          },
        ],
        materials: [],
        dataSources: [],
        variables: [],
        rules: [],
      },
    })
    expect(ctx.getState()['n1.text']).toBe('已点击')
  })
})
