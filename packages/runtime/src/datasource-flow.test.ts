/**
 * 运行态「数据源 → 表达式 → 渲染」链路。
 *
 * 之前**零覆盖**：`packages/runtime/src` 下所有测试的 `dataSources` 都是 `[]`。
 * 而这条链路是低代码平台的核心能力之一——数据源取到数据、表达式读到它、
 * 节点属性据此变化。
 */
import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type DataSource, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = { resolve: () => undefined, has: () => false }

function makeSchema(nodes: PageNode[], dataSources: DataSource[] = []): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '数据源测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources,
    variables: [],
    rules: [],
  }
}

function makeContext(nodes: PageNode[], dataSources: DataSource[] = []): RuntimeContext {
  return new RuntimeContext({
    schema: makeSchema(nodes, dataSources),
    resolver,
    actionRegistry: new ActionRegistry(),
  })
}

const STATIC_DS = {
  id: 'userInfo',
  name: '用户信息',
  type: 'static',
  config: { staticData: { name: '张三', age: 30 } },
} as unknown as DataSource

describe('运行态数据源 → 表达式', () => {
  it('static 数据源能取到数据', async () => {
    const ctx = makeContext([], [STATIC_DS])
    expect(await ctx.datasource.load('userInfo')).toEqual({ name: '张三', age: 30 })
  })

  it('取到的数据进入表达式上下文（$datasource）', async () => {
    const ctx = makeContext([], [STATIC_DS])
    await ctx.datasource.load('userInfo')
    const scope = ctx.buildExpressionContext()
    expect(scope.datasource).toHaveProperty('userInfo')
  })

  it('节点属性绑定 $datasource 时，解析出数据里的值', async () => {
    const node: PageNode = {
      id: 'n1',
      type: 'static-text',
      name: 'title',
      props: {
        // 表达式绑定：渲染时求值
        textContent: { type: 'expression', value: '$datasource.userInfo.name' },
      },
    }
    const ctx = makeContext([node], [STATIC_DS])
    await ctx.datasource.load('userInfo')
    // 注意：表达式上下文是**每次求值时现算**的，所以先 load 再 resolve 即可
    expect(ctx.resolveProp(node, 'textContent')).toBe('张三')
  })

  it('数据源加载后，表达式绑定取到的是新值（响应式刷新）', async () => {
    const ds = {
      id: 'counter',
      name: '计数器',
      type: 'static',
      config: { staticData: 1 },
    } as unknown as DataSource
    const node: PageNode = {
      id: 'n1',
      type: 'static-text',
      name: 't',
      props: { textContent: { type: 'expression', value: '$datasource.counter' } },
    }
    const ctx = makeContext([node], [ds])
    expect(ctx.resolveProp(node, 'textContent')).toBeUndefined()
    await ctx.datasource.load('counter')
    expect(ctx.resolveProp(node, 'textContent')).toBe(1)
  })

  it('表达式写错时不抛异常，而是记入错误收集器', () => {
    const node: PageNode = {
      id: 'n1',
      type: 'static-text',
      name: 't',
      props: { textContent: { type: 'expression', value: '$datasource.userInfo.name.' } },
    }
    const ctx = makeContext([node], [STATIC_DS])
    expect(() => ctx.resolveProp(node, 'textContent')).not.toThrow()
    // 错误记进 ErrorCollector.items（不是抛异常）——单组件出错不阻断整体渲染
    expect(ctx.errors.items.length).toBeGreaterThan(0)
    expect(ctx.errors.items[0]?.scope).toBe('expression')
  })
})
