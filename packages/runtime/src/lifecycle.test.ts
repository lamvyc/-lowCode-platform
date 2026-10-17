// @vitest-environment happy-dom
/**
 * 组件的生命周期钩子（`onCreated` / `onMounted`）。
 *
 * 参考实现用 `new Function(code).call(widget)` 执行用户写的代码，
 * 我们在运行时做同样的事。此前**完全没有这个能力**——22 个物料的
 * 事件设置里都缺这两项。
 */
import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = {
  has: () => true,
  resolve: () =>
    defineComponent({
      props: { text: { type: String, default: '' } },
      setup: (props) => () => h('span', { class: 'stub' }, String(props.text)),
    }),
}

function schemaWith(node: Partial<PageNode>): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: { id: 'p1', name: 'x', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    nodes: [{ id: 'n1', type: 'input', name: 'f1', props: {}, ...node } as PageNode],
    materials: [], dataSources: [], variables: [], rules: [],
  }
}

/**
 * ⚠️ 必须**真实挂载**（happy-dom），不能用 SSR：
 * `onVnodeMounted` 在服务端渲染时根本不会触发，
 * 用 SSR 测 `onMounted` 会得到"没执行"的假结论。
 */
async function render(schema: PageSchema, designMode = false) {
  const context = new RuntimeContext({ schema, resolver, actionRegistry: new ActionRegistry() })
  const host = document.createElement('div')
  document.body.appendChild(host)
  createApp({ render: () => h(RuntimeRenderer, { schema, context, designMode }) }).mount(host)
  await new Promise((r) => setTimeout(r, 30))
  host.remove()
  return context
}

describe('生命周期钩子', () => {
  it('onCreated 会执行，且 this.setValue 能写回组件值', async () => {
    const ctx = await render(schemaWith({ props: { onCreated: 'this.setValue("创建时写入")' } }))
    expect(ctx.getNodeValue('n1')).toBe('创建时写入')
  })

  it('onMounted 会执行', async () => {
    const ctx = await render(schemaWith({ props: { onMounted: 'this.setValue("挂载后写入")' } }))
    expect(ctx.getNodeValue('n1')).toBe('挂载后写入')
  })

  it('this.value 读得到当前值', async () => {
    const ctx = await render(
      schemaWith({ props: { modelValue: '初始', onCreated: 'this.setValue(this.value + "-改")' } }),
    )
    expect(ctx.getNodeValue('n1')).toBe('初始-改')
  })

  it('代码抛错时被隔离：不中断渲染，错误进收集器', async () => {
    const ctx = await render(schemaWith({ props: { onCreated: 'throw new Error("炸了")' } }))
    expect(ctx.errors.items.some((e) => e.message.includes('onCreated'))).toBe(true)
  })

  it('onCreated 每个节点只执行一次（同一运行时多次渲染不重复跑）', async () => {
    const schema = schemaWith({ props: { modelValue: '', onCreated: 'this.setValue(this.value + "x")' } })
    const context = new RuntimeContext({ schema, resolver, actionRegistry: new ActionRegistry() })
    for (let i = 0; i < 2; i += 1) {
      const host = document.createElement('div')
      document.body.appendChild(host)
      createApp({ render: () => h(RuntimeRenderer, { schema, context }) }).mount(host)
      await new Promise((r) => setTimeout(r, 20))
      host.remove()
    }
    expect(context.getNodeValue('n1')).toBe('x')
  })

  it('设计态不执行用户代码', async () => {
    const ctx = await render(schemaWith({ props: { modelValue: '', onCreated: 'this.setValue("不该执行")' } }), true)
    expect(ctx.getNodeValue('n1')).toBe('')
  })
})
