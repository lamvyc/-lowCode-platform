import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from './generator'

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '动作测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('事件与动作运行时', () => {
  it('按钮 click 生成处理器并绑定 @click', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        {
          id: 'b1',
          name: 'go',
          type: 'button',
          props: { label: '去' },
          events: {
            click: [{ id: 'a1', kind: 'navigate', config: { route: '#/detail' } }],
          },
        },
      ]),
    )
    expect(code).toContain('@click="onClick_b1"')
    expect(code).toContain('function onClick_b1(payload)')
    expect(code).toContain('location.hash = route')
    expect(code).toContain('#/detail')
  })

  it('setVariable / setProp / emitEvent 生成对应代码', async () => {
    const schema = schemaWith([
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '去' },
        events: {
          click: [
            { id: 'a1', kind: 'setVariable', config: { name: 'count', value: 1 } },
            { id: 'a2', kind: 'setProp', config: { nodeId: 'b1', prop: 'label', value: '已点' } },
            { id: 'a3', kind: 'emitEvent', config: { event: 'refresh' } },
          ],
        },
      },
    ])
    schema.variables = [{ id: 'v1', name: 'count', value: 0 }]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('count.value = value')
    expect(code).toContain('setNodeProp(')
    expect(code).toContain('action.config.nodeId || nodeId')
    expect(code).toContain('new CustomEvent')
    expect(code).toContain('已点')
  })

  it('action.when 用脚本模式重写（$page → .value）', async () => {
    const schema = schemaWith([
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '去' },
        events: {
          click: [
            {
              id: 'a1',
              kind: 'navigate',
              when: '$page.show',
              config: { route: '/a' },
            },
          ],
        },
      },
    ])
    schema.variables = [{ id: 'v1', name: 'show', value: true }]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('if (!show.value) continue')
  })

  it('submit 生成表单校验与 lc-submit 事件', async () => {
    const schema = schemaWith([
      { id: 'f1', name: 'a', type: 'input', props: { label: 'A' } },
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '提交' },
        events: { click: [{ id: 'a1', kind: 'submit', config: { formId: 'page' } }] },
      },
    ])
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('formRef.value')
    expect(code).toContain('.validate()')
    expect(code).toContain("new CustomEvent('lc-submit'")
  })

  it('refresh 调用对应数据源 loader', async () => {
    const schema = schemaWith([
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '刷新' },
        events: {
          click: [{ id: 'a1', kind: 'refresh', config: { dataSourceId: 'remote' } }],
        },
      },
    ])
    schema.dataSources = [
      { id: 'remote', name: '远程', type: 'rest', config: { url: '/api', method: 'GET' } },
    ]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('loadRemote()')
  })

  it('注入 core 同款表达式辅助函数', async () => {
    const { code } = await generateVueSfc(
      schemaWith([{ id: 'b1', name: 'go', type: 'button', props: { label: '去' } }]),
    )
    expect(code).toContain('function count(')
    expect(code).toContain('function isEmpty(')
  })

  it('config.expression 通过 evalExpression 求值', async () => {
    const schema = schemaWith([
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '去' },
        events: {
          click: [
            {
              id: 'a1',
              kind: 'setVariable',
              config: { name: 'count', expression: '$page.count + 1' },
            },
          ],
        },
      },
    ])
    schema.variables = [{ id: 'v1', name: 'count', value: 0 }]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('evalExpression(action.config.expression)')
    expect(code).toContain('/\\$page\\./g')
  })

  it('openDialog / custom 动作进入 warnings', async () => {
    const schema = schemaWith([
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '去' },
        events: {
          click: [
            { id: 'a1', kind: 'openDialog', config: { dialogId: 'd1' } },
            { id: 'a2', kind: 'custom', config: { actionId: 'x' } },
          ],
        },
      },
    ])
    const { warnings } = await generateVueSfc(schema)
    expect(warnings.some((warning) => warning.code === 'dialog-deferred')).toBe(true)
    expect(warnings.some((warning) => warning.code === 'custom-action-deferred')).toBe(true)
  })

  it('模板为节点加 v-bind overrides', async () => {
    const { code } = await generateVueSfc(
      schemaWith([{ id: 'b1', name: 'go', type: 'button', props: { label: '去' } }]),
    )
    expect(code).toContain("v-bind=\"overrides['b1']\"")
  })
})
