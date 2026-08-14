import { describe, expect, it, vi } from 'vitest'
import type { Rule } from '@lowcode/schema'
import {
  ActionRegistry,
  JexlExpressionEngine,
  RuleEngine,
  createBuiltinActions,
} from '@lowcode/core'

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: '规则',
    enabled: true,
    trigger: 'expression',
    condition: 'inputValue === "其他"',
    actions: [
      {
        id: 'a1',
        kind: 'setProp',
        config: { nodeId: 'n1', prop: 'visible', value: true },
      },
    ],
    ...overrides,
  }
}

describe('RuleEngine 规则引擎', () => {
  it('条件命中时执行动作', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const engine = new RuleEngine({
      expression: new JexlExpressionEngine(),
      actionRegistry: registry,
    })
    const results = await engine.run(
      [makeRule()],
      { inputValue: '其他' },
      {
        expression: new JexlExpressionEngine(),
        getState: () => ({ inputValue: '其他' }),
        setState: () => {},
      },
    )
    expect(results[0]?.matched).toBe(true)
  })

  it('条件不命中时不执行动作', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const engine = new RuleEngine({
      expression: new JexlExpressionEngine(),
      actionRegistry: registry,
    })
    const results = await engine.run(
      [makeRule()],
      { inputValue: 'A' },
      {
        expression: new JexlExpressionEngine(),
        getState: () => ({ inputValue: 'A' }),
        setState: () => {},
      },
    )
    expect(results[0]?.matched).toBe(false)
  })

  it('循环依赖不会导致死循环', async () => {
    const engine = new RuleEngine({
      expression: new JexlExpressionEngine(),
      actionRegistry: new ActionRegistry(),
    })
    const a = makeRule({ id: 'a', dependsOn: ['b'] })
    const b = makeRule({ id: 'b', dependsOn: ['a'] })
    const results = await engine.run(
      [a, b],
      { inputValue: '其他' },
      {
        expression: new JexlExpressionEngine(),
        getState: () => ({ inputValue: '其他' }),
        setState: () => {},
      },
    )
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  it('debounceMs 防止重复触发', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const execute = vi.fn()
    registry.register({
      kind: 'track',
      execute: () => {
        execute()
        return { ok: true }
      },
    })
    const engine = new RuleEngine({
      expression: new JexlExpressionEngine(),
      actionRegistry: registry,
    })
    const rule = makeRule({
      debounceMs: 1000,
      actions: [{ id: 'a1', kind: 'custom', config: { actionId: 'track' } }],
    })
    const ctx = {
      expression: new JexlExpressionEngine(),
      getState: () => ({ inputValue: '其他' }),
      setState: () => {},
    }
    await engine.run([rule], { inputValue: '其他' }, ctx)
    await engine.run([rule], { inputValue: '其他' }, ctx)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('统一 Schema 的 expression 字段优先于旧 condition', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const engine = new RuleEngine({
      expression: new JexlExpressionEngine(),
      actionRegistry: registry,
    })
    const rule = makeRule({ expression: 'inputValue === "新条件"', condition: 'false' })
    const results = await engine.run(
      [rule],
      { inputValue: '新条件' },
      {
        expression: new JexlExpressionEngine(),
        getState: () => ({ inputValue: '新条件' }),
        setState: () => {},
      },
    )
    expect(results[0]?.matched).toBe(true)
  })
})
