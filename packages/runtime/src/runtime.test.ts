import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ActionRegistry, createBuiltinActions } from '@lowcode/core'
import { createUnifiedPageSchema, type PageSchema } from '@lowcode/schema'
import { SCHEMA_VERSION } from '@lowcode/schema'
import { RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

/** 测试用物料：纯 render 函数，避免依赖 SFC 编译 */
function makeTextComponent() {
  return defineComponent({
    name: 'Text',
    props: {
      text: { type: String, default: '' },
      color: { type: String, default: '' },
    },
    setup(props) {
      return () =>
        h('span', { style: props.color ? { color: props.color } : {} }, props.text)
    },
  })
}

function makeBoxComponent() {
  return defineComponent({
    name: 'Box',
    setup(_, { slots }) {
      return () => h('div', { class: 'box' }, slots.default?.())
    },
  })
}

const resolver: IComponentResolver = {
  resolve: (type) =>
    type === 'text'
      ? makeTextComponent()
      : type === 'box'
        ? makeBoxComponent()
        : undefined,
  has: (type) => type === 'text' || type === 'box',
}

function makeSchema(nodes: PageSchema['nodes']): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '运行时测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

async function render(schema: PageSchema) {
  const context = new RuntimeContext({
    schema,
    resolver,
    actionRegistry: new ActionRegistry(),
  })
  const app = createSSRApp({
    render: () => h(RuntimeRenderer, { schema, context }),
  })
  return renderToString(app)
}

describe('Runtime Renderer', () => {
  it('渲染静态文本节点', async () => {
    const html = await render(
      makeSchema([{ id: 'n1', type: 'text', props: { text: '你好，低代码' } }]),
    )
    expect(html).toContain('你好，低代码')
  })

  it('容器子节点只渲染一次（不重复挂载到根层级）', async () => {
    const html = await render(
      makeSchema([
        {
          id: 'root',
          type: 'box',
          props: {},
          children: ['child'],
        },
        { id: 'child', type: 'text', props: { text: 'CHILD_ONLY' } },
      ]),
    )
    expect(html).toContain('<div class="box">')
    expect(html).toContain('CHILD_ONLY')
    expect(html.match(/CHILD_ONLY/g)).toHaveLength(1)
  })

  it('visible 表达式为假时不渲染节点', async () => {
    const html = await render(
      makeSchema([
        {
          id: 'n1',
          type: 'text',
          props: { text: '隐藏' },
          bindings: { visible: { type: 'expression', value: 'false' } },
        },
      ]),
    )
    expect(html).not.toContain('隐藏')
  })

  it('loop 绑定按数据源渲染多项', async () => {
    const schema = makeSchema([
      {
        id: 'n1',
        type: 'text',
        props: { text: { type: 'expression', value: '"item=" + item' } },
        bindings: {
          loop: {
            type: 'static',
            value: { source: '[1, 2, 3]', itemName: 'item' },
          },
        },
      },
    ])
    const html = await render(schema)
    expect(html).toContain('item=1')
    expect(html).toContain('item=2')
    expect(html).toContain('item=3')
  })

  it('表达式属性读取数据源数据', async () => {
    const context = new RuntimeContext({
      schema: makeSchema([
        {
          id: 'n1',
          type: 'text',
          props: {
            text: { type: 'expression', value: '$datasource.users.data[0].name' },
          },
        },
      ]),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    context.datasource.register({
      id: 'users',
      name: '用户',
      type: 'static',
      config: { staticData: { data: [{ name: '张三' }] } },
    })
    context.datasource.setData('users', { data: [{ name: '张三' }] })
    const app = createSSRApp({
      render: () => h(RuntimeRenderer, { schema: context.schema, context }),
    })
    const html = await renderToString(app)
    expect(html).toContain('张三')
  })

  it('style 绑定输出内联样式', async () => {
    const html = await render(
      makeSchema([
        {
          id: 'n1',
          type: 'text',
          props: { text: '红色' },
          style: { color: { type: 'static', value: 'red' } },
        },
      ]),
    )
    expect(html).toContain('color:red')
  })

  it('未注册物料渲染占位提示', async () => {
    const html = await render(
      makeSchema([{ id: 'n1', type: 'unknown-widget', props: {} }]),
    )
    expect(html).toContain('未注册物料')
  })

  it('渲染统一 Page Schema（自动归一化为运行时视图）', async () => {
    const unified = createUnifiedPageSchema({ id: 'up1', name: '统一页面' }, {
      nodes: [{ id: 'n1', type: 'text', props: { text: '统一 Schema 渲染' } }],
    })
    const context = new RuntimeContext({
      schema: unified,
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    expect(context.schema.meta.id).toBe('up1')
    const app = createSSRApp({
      render: () => h(RuntimeRenderer, { schema: context.schema, context }),
    })
    const html = await renderToString(app)
    expect(html).toContain('统一 Schema 渲染')
  })

  it('表达式上下文支持 $state / $api（P3）', () => {
    const context = new RuntimeContext({
      schema: makeSchema([{ id: 'n1', type: 'text', props: { text: '' } }]),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    context.state.visible = true
    context.datasource.setData('users', [{ name: '张三' }])
    const exprContext = context.buildExpressionContext()
    const stateResult = context.expression.tryEvaluate('$state.visible == true', exprContext)
    expect(stateResult).toEqual({ ok: true, value: true })
    const apiResult = context.expression.tryEvaluate('$api.users[0].name', exprContext)
    expect(apiResult).toEqual({ ok: true, value: '张三' })
  })

  it('节点索引 getNode O(1) 查找全部节点', () => {
    const context = new RuntimeContext({
      schema: makeSchema([
        { id: 'n1', type: 'text', props: { text: 'a' } },
        { id: 'n2', type: 'text', props: { text: 'b' } },
      ]),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    expect(context.getNode('n1')?.props.text).toBe('a')
    expect(context.getNode('n2')?.props.text).toBe('b')
    expect(context.getNode('missing')).toBeUndefined()
  })

  it('mount 规则在 init 时执行', async () => {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    const context = new RuntimeContext({
      schema: makeSchema([
        {
          id: 'n1',
          type: 'text',
          props: { text: 'x' },
          events: {
            mount: [],
          },
        },
      ]),
      resolver,
      actionRegistry: registry,
    })
    context.schema.rules.push({
      id: 'r_mount',
      name: '挂载规则',
      enabled: true,
      trigger: 'mount',
      condition: 'true',
      actions: [
        {
          id: 'a1',
          kind: 'setVariable',
          config: { name: 'mounted', value: true },
        },
      ],
    })
    await context.init()
    expect(context.variables.mounted).toBe(true)
  })

  it('单节点渲染失败降级为占位并记录错误，不阻断整页', async () => {
    const boomResolver: IComponentResolver = {
      resolve: (type) => {
        if (type === 'boom') throw new Error('组件爆炸')
        return makeTextComponent()
      },
      has: () => true,
    }
    const context = new RuntimeContext({
      schema: makeSchema([
        { id: 'bad', type: 'boom', props: {} },
        { id: 'ok', type: 'text', props: { text: '正常节点' } },
      ]),
      resolver: boomResolver,
      actionRegistry: new ActionRegistry(),
    })
    const app = createSSRApp({
      render: () => h(RuntimeRenderer, { schema: context.schema, context }),
    })
    const html = await renderToString(app)
    expect(html).toContain('渲染失败')
    expect(html).toContain('正常节点')
    expect(context.errors.items.some((e) => e.scope === 'render' && e.nodeId === 'bad')).toBe(true)
  })

  it('渲染耗时与表达式错误被采集到 metrics / errors', async () => {
    const context = new RuntimeContext({
      schema: makeSchema([
        {
          id: 'n1',
          type: 'text',
          props: { text: { type: 'expression', value: '???' } },
        },
      ]),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    const app = createSSRApp({
      render: () => h(RuntimeRenderer, { schema: context.schema, context }),
    })
    await renderToString(app)
    const metrics = context.metrics.snapshot()
    expect(metrics['render'].count).toBeGreaterThanOrEqual(1)
    expect(metrics['render.nodes'].count).toBeGreaterThanOrEqual(1)
    expect(context.errors.items.some((e) => e.scope === 'expression' && e.nodeId === 'n1')).toBe(true)
  })
})
