/**
 * **错误隔离**：一张页面上有一个坏节点，不能让整页挂掉。
 *
 * 这是运行时 `ErrorCollector` + 渲染层 try/catch 的设计目标，但此前没有测试
 * 验证"坏节点旁边的好节点是否照常渲染"。低代码平台上用户随手配错一个表达式是常态，
 * 这条属性比"渲染得对不对"更基础。
 */
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

/** 只认识 text 一种物料的解析器；其它类型一律"未注册" */
const resolver: IComponentResolver = {
  has: (type: string) => type === 'text',
  resolve: (type: string) =>
    type === 'text'
      ? defineComponent({
          name: 'Text',
          props: { text: { type: String, default: '' } },
          setup(props) {
            return () => h('span', { class: 'stub-text' }, String(props.text))
          },
        })
      : undefined,
}

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '隔离测试',
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
  return { html: await renderToString(app), context }
}

const ok = (id: string, text: string): PageNode => ({
  id,
  type: 'text',
  name: id,
  props: { text },
})

describe('错误隔离：坏节点不拖垮整页', () => {
  it('未注册物料渲染成占位，其它节点照常渲染', async () => {
    const { html, context } = await render(
      makeSchema([ok('n1', '前面正常'), { id: 'n2', type: '不存在的物料', name: 'bad', props: {} }, ok('n3', '后面正常')]),
    )
    expect(html).toContain('前面正常')
    expect(html).toContain('后面正常')
    expect(html).toContain('未注册物料')
    // 未注册物料不是"渲染错误"，只是占位，不该污染错误收集器
    expect(context.errors.items.filter((e) => e.scope === 'render')).toHaveLength(0)
  })

  it('表达式绑定写错时，该节点降级、其它节点照常渲染，且错误被记录', async () => {
    const broken: PageNode = {
      id: 'n2',
      type: 'text',
      name: 'bad',
      // 语法错误的表达式：求值会失败
      props: { text: { type: 'expression', value: '$page.a b c +++' } as never },
    }
    const { html, context } = await render(makeSchema([ok('n1', '前面正常'), broken, ok('n3', '后面正常')]))
    expect(html).toContain('前面正常')
    expect(html).toContain('后面正常')
    // 表达式错误进错误收集器（scope: expression）
    expect(context.errors.items.some((e) => e.scope === 'expression')).toBe(true)
  })

  it('数据源加载失败不阻断渲染', async () => {
    const schema = makeSchema([ok('n1', '照常渲染')])
    schema.dataSources = [
      {
        id: 'bad',
        name: '坏数据源',
        type: 'rest',
        // 没有注入 http → 取数会抛错
        config: { url: '/x' },
      },
    ] as never
    const context = new RuntimeContext({
      schema,
      resolver,
      actionRegistry: new ActionRegistry(),
    })
    await expect(context.init()).resolves.toBeUndefined()
    const app = createSSRApp({ render: () => h(RuntimeRenderer, { schema, context }) })
    expect(await renderToString(app)).toContain('照常渲染')
    expect(context.errors.items.length).toBeGreaterThan(0)
  })
})
