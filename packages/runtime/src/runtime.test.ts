import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import type { PageSchema } from '@lowcode/schema'
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

const resolver: IComponentResolver = {
  resolve: (type) => (type === 'text' ? makeTextComponent() : undefined),
  has: (type) => type === 'text',
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
})
