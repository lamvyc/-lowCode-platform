import {
  createSSRApp,
  defineComponent,
  effect,
  h,
  inject,
  isRef,
  type PropType,
  type VNode,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ActionRegistry, createBuiltinActions } from '@lowcode/core'
import { createUnifiedPageSchema, type PageSchema } from '@lowcode/schema'
import { SCHEMA_VERSION } from '@lowcode/schema'
import { RuntimeContext, RuntimeRenderer, renderNode } from '@lowcode/runtime'
import { RUNTIME_CONTEXT_KEY } from './context'
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
      // 同时渲染 default 与具名插槽，便于覆盖插槽渲染路径
      return () => h('div', { class: 'box' }, [slots.default?.(), slots.named?.()])
    },
  })
}

/** 测试用字段物料：受控组件，值由 modelValue 决定，变更时 emit update:modelValue */
function makeFieldComponent() {
  return defineComponent({
    name: 'Field',
    props: {
      modelValue: { type: [String, Number, Boolean] as PropType<unknown>, default: '' },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'field',
          value: String(props.modelValue ?? ''),
          onInput: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLInputElement).value),
        })
    },
  })
}

const resolver: IComponentResolver = {
  resolve: (type) =>
    type === 'text'
      ? makeTextComponent()
      : type === 'box'
        ? makeBoxComponent()
        : type === 'field'
          ? makeFieldComponent()
          : undefined,
  has: (type) => type === 'text' || type === 'box' || type === 'field',
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

  it('slots.default 为空数组时不得覆盖 children 渲染（NodeFactory 会初始化该字段）', async () => {
    const html = await render(
      makeSchema([
        {
          id: 'root',
          type: 'box',
          props: {},
          children: ['child'],
          // 物料声明 slots: ['default'] 时工厂会写入该字段，历史数据也可能存在
          slots: { default: [] },
        },
        { id: 'child', type: 'text', props: { text: 'CHILD_ONLY' } },
      ]),
    )
    expect(html).toContain('<div class="box">')
    expect(html).toContain('CHILD_ONLY')
    expect(html.match(/CHILD_ONLY/g)).toHaveLength(1)
  })

  it('具名插槽仍然按 slots 渲染', async () => {
    const html = await render(
      makeSchema([
        { id: 'root', type: 'box', props: {}, slots: { named: ['child'] } },
        { id: 'child', type: 'text', props: { text: 'NAMED_ONLY' } },
      ]),
    )
    expect(html).toContain('NAMED_ONLY')
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

describe('字段值写回（v-model → 运行时值存储）', () => {
  function makeContext(nodes: PageSchema['nodes']) {
    return new RuntimeContext({
      schema: makeSchema(nodes),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
  }

  /**
   * 字段节点会被渲染器包一层 FieldContextProvider（用于 provide 节点身份），
   * 因此要取物料组件自身的 vnode 需要往下走一层插槽。
   */
  function innerVNode(vnode: VNode | null): VNode {
    expect(vnode).not.toBeNull()
    const children = (vnode as VNode).children as
      | Record<string, (() => VNode) | undefined>
      | null
    return children?.default ? children.default() : (vnode as VNode)
  }

  it('声明了 modelValue 的节点会被接上 update:modelValue', () => {
    const context = makeContext([{ id: 'f1', type: 'field', props: { modelValue: 'init' } }])
    const vnode = renderNode('f1', context, (_node, inner) => inner)
    expect(typeof innerVNode(vnode).props?.['onUpdate:modelValue']).toBe('function')
  })

  it('未声明 modelValue 的节点不接 update:modelValue', () => {
    const context = makeContext([{ id: 't1', type: 'text', props: { text: 'hi' } }])
    const vnode = renderNode('t1', context, (_node, inner) => inner)
    expect((vnode as VNode).props?.['onUpdate:modelValue']).toBeUndefined()
  })

  it('字段节点会被包一层 FieldContextProvider，且节点身份传给了物料', () => {
    const context = makeContext([
      { id: 'f1', name: 'userName', type: 'field', props: { modelValue: 'init' } },
    ])
    const outer = renderNode('f1', context, (_node, inner) => inner) as VNode
    const providerProps = outer.props as Record<string, unknown>
    expect(providerProps?.nodeId).toBe('f1')
    expect(providerProps?.fieldName).toBe('userName')
    expect(innerVNode(outer).props?.['modelValue']).toBe('init')
  })

  it('值变化写回运行时，且**不改写 schema**', () => {
    const context = makeContext([{ id: 'f1', type: 'field', props: { modelValue: 'init' } }])
    const node = context.getNode('f1')
    expect(node).toBeDefined()
    const vnode = renderNode('f1', context, (_n, inner) => inner)
    const onUpdate = innerVNode(vnode).props?.['onUpdate:modelValue'] as (value: unknown) => void

    onUpdate('typed')

    expect(context.getNodeValue('f1')).toBe('typed')
    // schema 里的"默认值"必须原样保留：否则用户敲进去的内容会变成默认值，并污染撤销历史
    expect(node?.props.modelValue).toBe('init')
  })

  it('写回是响应式的，且每次写入只触发一次更新', () => {
    const context = makeContext([{ id: 'f1', type: 'field', props: { modelValue: 'a' } }])
    const node = context.getNode('f1')
    expect(node).toBeDefined()
    const seen: unknown[] = []
    const stop = effect(() => {
      seen.push(context.resolveProp(node!, 'modelValue'))
    })
    expect(seen).toEqual(['a'])

    // 逐个断言，而不是先累积再比较总次数：Vue 3.5 里 stop() 自身会再触发一次求值，
    // 把它算进来会淹没"一次写入只触发一次更新"这个真正要保证的性质。
    context.setNodeValue('f1', 'b')
    expect(seen).toEqual(['a', 'b'])

    context.setNodeValue('f1', 'c')
    expect(seen).toEqual(['a', 'b', 'c'])

    stop()
  })

  it('受控渲染：写回后重新渲染得到新值', async () => {
    const schema = makeSchema([{ id: 'f1', type: 'field', props: { modelValue: 'init' } }])
    const context = new RuntimeContext({ schema, resolver, actionRegistry: new ActionRegistry() })
    context.setNodeValue('f1', 'typed')
    const app = createSSRApp({
      render: () => h(RuntimeRenderer, { schema, context }),
    })
    expect(await renderToString(app)).toContain('value="typed"')
  })

  it('RUNTIME_CONTEXT_KEY 注入的是 ref（上下文重建后下游不会拿到陈旧对象）', async () => {
    // 编辑器每次 schema 变更都会重建 RuntimeContext，而 provide 只在 setup 执行一次。
    // 因此注入值必须是 ref 并由渲染器同步；若回退成直接 provide 上下文对象，用例会失败。
    const probe: IComponentResolver = {
      resolve: (type) =>
        type === 'probe'
          ? defineComponent({
              name: 'Probe',
              setup() {
                const injected = inject(RUNTIME_CONTEXT_KEY, undefined)
                return () =>
                  h('span', { class: 'probe' }, isRef(injected) && injected.value ? 'REF_OK' : 'NOT_REF')
              },
            })
          : undefined,
      has: (type) => type === 'probe',
    }
    const schema = makeSchema([{ id: 'p1', type: 'probe', props: {} }])
    const context = new RuntimeContext({
      schema,
      resolver: probe,
      actionRegistry: new ActionRegistry(),
    })
    const app = createSSRApp({ render: () => h(RuntimeRenderer, { schema, context }) })
    expect(await renderToString(app)).toContain('REF_OK')
  })
})
