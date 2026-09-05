import {
  Fragment,
  defineComponent,
  h,
  provide,
  type Component,
  type PropType,
  type VNode,
} from 'vue'
import type { AnyPageSchema, PageNode } from '@lowcode/schema'
import { RUNTIME_CONTEXT_KEY, type RuntimeContext } from './context'

type LoopCtx = { itemName: string; indexName?: string; item: unknown; index: number }

/** DOM 事件名 → Vue onXxx 属性名 */
function toOnProp(eventName: string): string {
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`
}

/** 深度：防止 schema 异常导致无限递归 */
const MAX_DEPTH = 32

/**
 * Runtime Renderer：消费 PageSchema 并递归渲染整棵节点树。
 * 关键闭环：Schema → Resolver → Vue 组件 → Props/Bindings/Events → Children/Slots → UI
 */
export function renderNode(
  nodeId: string,
  ctx: RuntimeContext,
  wrap: (node: PageNode, inner: VNode) => VNode,
  loop?: LoopCtx,
  depth = 0,
): VNode | null {
  if (depth > MAX_DEPTH) return null
  // O(1) 节点索引查找，替代 O(n) 线性扫描（500 组件页从 25 万次查找降到 500 次）
  const node = ctx.getNode(nodeId)
  if (!node) return null
  if (node.meta?.hidden) return null
  if (!ctx.resolveVisible(node, loop)) return null

  const loopResolution = ctx.resolveLoop(node)
  if (loopResolution) {
    const vnodes: VNode[] = []
    loopResolution.items.forEach((item, index) => {
      // 循环节点本体渲染一次，循环上下文传给它的内容子树
      const child = buildNode(
        node,
        ctx,
        wrap,
        {
          itemName: loopResolution.itemName,
          indexName: loopResolution.indexName,
          item,
          index,
        },
        depth + 1,
      )
      if (child) vnodes.push(child)
    })
    return h(Fragment, vnodes)
  }

  return buildNode(node, ctx, wrap, loop, depth)
}

function buildNode(
  node: PageNode,
  ctx: RuntimeContext,
  wrap: (node: PageNode, inner: VNode) => VNode,
  loop: LoopCtx | undefined,
  depth: number,
): VNode | null {
  try {
    const component = ctx.resolver.resolve(node.type)
    if (!component) {
      return h(
        'div',
        { class: 'lc-missing', 'data-node-type': node.type },
        `[未注册物料: ${node.type}]`,
      )
    }

    // Props：静态值 / 表达式绑定 / 本地覆盖
    const props: Record<string, unknown> = {}
    for (const key of Object.keys(node.props)) {
      props[key] = ctx.resolveProp(node, key, loop)
    }

    // Style：表达式或静态绑定
    const style = ctx.resolveStyle(node, loop)
    if (Object.keys(style).length > 0) props.style = style

    // Events：DOM 事件 → 动作链
    for (const eventName of Object.keys(node.events ?? {})) {
      props[toOnProp(eventName)] = (event: unknown) => {
        ctx.dispatchNodeEvent(node, eventName, event)
      }
    }

    // Children / Slots
    const childrenIds = node.children ?? []
    const renderChild = (id: string): VNode | null => renderNode(id, ctx, wrap, loop, depth + 1)
    const defaultSlot = childrenIds.map(renderChild).filter(Boolean) as VNode[]
    const slots: Record<string, () => VNode[]> = { default: () => defaultSlot }
    for (const [slotName, ids] of Object.entries(node.slots ?? {})) {
      slots[slotName] = () =>
        ids.map(renderChild).filter(Boolean) as VNode[]
    }

    const vnode = h(component as Component, props, slots)
    return wrap(node, vnode)
  } catch (error) {
    // 容错降级（E4）：单节点渲染失败不拖垮整页，渲染占位并记录错误上下文
    const message = error instanceof Error ? error.message : String(error)
    ctx.errors.add(
      { scope: 'render', message, nodeId: node.id },
      `render:${node.id}`,
    )
    return h(
      'div',
      { class: 'lc-render-error', 'data-node-id': node.id, 'data-node-type': node.type },
      `[渲染失败: ${message}]`,
    )
  }
}

export interface RuntimeRendererProps {
  schema: AnyPageSchema
  context: RuntimeContext
  /** 编辑器用 wrapNode 包一层选择/悬停/落点覆盖层 */
  wrapNode?: (node: PageNode, inner: VNode) => VNode
}

/** 渲染器组件：接收 schema + 运行时上下文 */
export const RuntimeRenderer = defineComponent({
  name: 'RuntimeRenderer',
  props: {
    schema: { type: Object as PropType<AnyPageSchema>, required: true },
    context: { type: Object as PropType<RuntimeContext>, required: true },
    wrapNode: {
      type: Function as PropType<RuntimeRendererProps['wrapNode']>,
      default: (_node: PageNode, inner: VNode) => inner,
    },
  },
  setup(props) {
    provide(RUNTIME_CONTEXT_KEY, props.context)
    return () => {
      const wrap = props.wrapNode ?? ((_node: PageNode, inner: VNode) => inner)
      const end = props.context.metrics.start('render')
      try {
        // 只渲染根级节点：子节点由父容器插槽递归渲染，避免平铺数组重复挂载
        const nodes = props.context.schema.nodes
        const referenced = new Set<string>()
        for (const node of nodes) {
          for (const childId of node.children ?? []) referenced.add(childId)
          for (const ids of Object.values(node.slots ?? {})) {
            for (const id of ids) referenced.add(id)
          }
        }
        const rootIds = nodes.filter((node) => !referenced.has(node.id)).map((node) => node.id)
        const children = rootIds
          .map((id) => renderNode(id, props.context, wrap))
          .filter(Boolean) as VNode[]
        props.context.metrics.increment('render.nodes', children.length)
        return h('div', { class: 'lc-runtime-root' }, children)
      } finally {
        end()
      }
    }
  },
})
