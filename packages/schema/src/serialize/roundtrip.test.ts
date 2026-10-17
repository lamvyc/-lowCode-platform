/**
 * 保存 → 加载 的**往返完整性**。
 *
 * 这是低代码平台的根本能力："我配好的页面，存下来再打开还在不在"。
 * 也是数据丢失的经典高发区——序列化是 `JSON.stringify`，反序列化要过 **Zod 校验**，
 * 而 Zod 默认会**丢掉未声明字段**。任何一处没声明，用户配的东西就静默消失。
 *
 * 这份测试用一个"字段尽量全"的 schema 做往返，逐个高风险点断言。
 */
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type PageSchema } from '@lowcode/schema'
import { deserializePage, serializePage } from './serializer'

function richSchema(): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '往返测试',
      description: '覆盖各类字段',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [
      {
        id: 'n1',
        type: 'input',
        name: 'userName',
        props: { label: '姓名', modelValue: '', required: true, placeholder: '请输入' },
        events: {
          change: [
            {
              id: 'a1',
              kind: 'setProp',
              config: { nodeId: 'n1', prop: 'placeholder', value: '变了' },
            },
          ],
        },
      },
      {
        id: 'n2',
        type: 'button',
        name: 'goBtn',
        props: { text: '去详情' },
        events: {
          click: [{ id: 'a2', kind: 'navigate', config: { route: '/detail' } }],
        },
      },
    ],
    materials: [{ type: 'input' }, { type: 'button' }],
    dataSources: [
      {
        id: 'ds1',
        name: '用户列表',
        type: 'rest',
        config: { url: '/api/users', method: 'GET', params: { page: 1 } },
      },
    ],
    variables: [{ id: 'v1', name: 'count', value: 0 }],
    rules: [
      {
        id: 'r1',
        name: '数量大于 0',
        enabled: true,
        trigger: 'expression',
        condition: '$page.count > 0',
        actions: [{ id: 'a3', kind: 'setProp', config: { nodeId: 'n1', prop: 'disabled', value: true } }],
      },
    ],
    settings: {},
  } as PageSchema
}

describe('保存 → 加载 往返完整性', () => {
  it('整体往返后与原始 schema 深度相等', () => {
    const original = richSchema()
    const round = deserializePage(serializePage(original))
    expect(round).toEqual(original)
  })

  it('节点事件与动作链不丢（含 action id / kind / config）', () => {
    const round = deserializePage(serializePage(richSchema()))
    const btn = round.nodes.find((n) => n.id === 'n2')
    expect(btn?.events?.click?.[0]).toMatchObject({
      id: 'a2',
      kind: 'navigate',
      config: { route: '/detail' },
    })
  })

  it('数据源的 config 不丢（url / method / params）', () => {
    const round = deserializePage(serializePage(richSchema()))
    expect(round.dataSources[0]).toMatchObject({
      id: 'ds1',
      name: '用户列表',
      type: 'rest',
      config: { url: '/api/users', method: 'GET', params: { page: 1 } },
    })
  })

  it('规则不丢（trigger / condition / actions）', () => {
    const round = deserializePage(serializePage(richSchema()))
    const rule = round.rules[0]
    expect(rule).toMatchObject({
      id: 'r1',
      enabled: true,
      trigger: 'expression',
      condition: '$page.count > 0',
    })
    expect(rule?.actions?.[0]).toMatchObject({ kind: 'setProp' })
  })

  it('页面变量不丢', () => {
    const round = deserializePage(serializePage(richSchema()))
    expect(round.variables).toEqual([{ id: 'v1', name: 'count', value: 0 }])
  })

  it('节点 props 里的自定义键不丢（低代码的值千变万化）', () => {
    const original = richSchema()
    original.nodes[0]!.props = {
      ...original.nodes[0]!.props,
      自定义键: '自定义值',
      nested: { a: 1, b: [2, 3] },
    }
    const round = deserializePage(serializePage(original))
    expect(round.nodes[0]?.props).toEqual(original.nodes[0]?.props)
  })

  it('两次往返的结果稳定（第二次序列化与第一次字节一致）', () => {
    const once = serializePage(deserializePage(serializePage(richSchema())))
    const twice = serializePage(deserializePage(once))
    expect(twice).toBe(once)
  })
})
