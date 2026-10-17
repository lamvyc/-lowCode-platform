/**
 * 运行时的**规则链路**：规则声明在页面 schema 里，由 `RuntimeContext` 在
 * mount / datasource / expression 时机执行。
 *
 * 之前零覆盖：`packages/core/src/rule.test.ts` 只测了 RuleEngine 本身
 * （条件命中、debounce、循环依赖），**没有一条测试是从"schema 里声明规则"
 * 一路跑到"动作真的执行了"**。
 */
import { describe, expect, it } from 'vitest'
import { ActionRegistry, createBuiltinActions } from '@lowcode/core'
import {
  SCHEMA_VERSION,
  type DataSource,
  type EventAction,
  type PageNode,
  type PageSchema,
  type Rule,
} from '@lowcode/schema'
import { RuntimeContext } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = { resolve: () => undefined, has: () => false }

function makeSchema(
  nodes: PageNode[],
  rules: Rule[] = [],
  dataSources: DataSource[] = [],
): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '规则测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources,
    variables: [],
    rules,
  }
}

/**
 * ⚠️ 必须用 `createBuiltinActions()` 填满注册表。
 * 空的 `ActionRegistry` 不会报错——`ActionChainRunner` 找不到 `setProp` 时
 * **静默跳过**，表现为"规则跑了但动作没生效"（我第一次就栽在这，
 * `metrics` 里明明有 `rules.run`，值却一直是空）。
 */
function makeRegistry(): ActionRegistry {
  const registry = new ActionRegistry()
  registry.registerMany(createBuiltinActions())
  return registry
}

/** 构造运行时（走真实构造签名） */
function makeRuntime(schema: PageSchema): RuntimeContext {
  return new RuntimeContext({
    schema,
    resolver,
    actionRegistry: makeRegistry(),
  })
}

const targetNode: PageNode = {
  id: 'n1',
  type: 'input',
  name: 'target',
  props: { label: '目标', modelValue: '' },
}

/** 把目标节点的 modelValue 改成给定值 */
function writeValue(value: string): EventAction[] {
  return [
    {
      id: 'a1',
      kind: 'setProp',
      config: { nodeId: 'n1', prop: 'modelValue', value },
    },
  ]
}

function makeRule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: '测试规则',
    enabled: true,
    trigger: 'mount',
    condition: 'true',
    actions: writeValue('规则写入'),
    ...over,
  } as Rule
}

describe('运行时规则链路', () => {
  it('mount 规则在 init 时执行，动作真的改写了节点值', async () => {
    const ctx = makeRuntime(makeSchema([targetNode], [makeRule()]))
    await ctx.init()
    expect(ctx.getNodeValue('n1')).toBe('规则写入')
  })

  it('条件不成立时不执行', async () => {
    const ctx = makeRuntime(makeSchema([targetNode], [makeRule({ condition: 'false' })]))
    await ctx.init()
    expect(ctx.getNodeValue('n1')).toBe('')
  })

  it('enabled: false 的规则被跳过', async () => {
    const ctx = makeRuntime(makeSchema([targetNode], [makeRule({ enabled: false })]))
    await ctx.init()
    expect(ctx.getNodeValue('n1')).toBe('')
  })

  it('触发时机不匹配的规则不执行（event 规则不该在 mount 时跑）', async () => {
    const ctx = makeRuntime(makeSchema([targetNode], [makeRule({ trigger: 'event' })]))
    await ctx.init()
    expect(ctx.getNodeValue('n1')).toBe('')
  })

  it('datasource 规则在数据源加载后执行', async () => {
    const ds = {
      id: 'ds1',
      name: '数据',
      type: 'static',
      config: { staticData: [1, 2, 3] },
    } as unknown as DataSource
    const ctx = makeRuntime(
      makeSchema([targetNode], [makeRule({ trigger: 'datasource' })], [ds]),
    )
    // 只 load 数据源，不走 init（init 会先跑 mount 规则）
    await ctx.datasource.load('ds1')
    // onStateChange 的回调是 void 的，等一个微任务
    await new Promise((r) => setTimeout(r, 20))
    expect(ctx.getNodeValue('n1')).toBe('规则写入')
  })

  it('规则里的动作失败时**不静默**：记入错误收集器且不抛异常', async () => {
    // 用一个没注册的动作类型：ActionChainRunner 会产出 `{ok:false, error:'未知动作…'}`
    const badRule = makeRule({
      // kind 是枚举（setProp|…|custom），所以用 `custom` + 一个没注册的 actionId
      // 来构造"动作不存在"的失败路径
      actions: [{ id: 'a1', kind: 'custom', config: { actionId: 'nope' } }] as EventAction[],
    })
    const ctx = makeRuntime(makeSchema([targetNode], [badRule]))
    await expect(ctx.init()).resolves.toBeUndefined()
    const ruleErrors = ctx.errors.items.filter((e) => e.scope === 'rule')
    expect(ruleErrors.length).toBeGreaterThan(0)
    expect(ruleErrors[0]?.message).toContain('未知动作')
  })
})
