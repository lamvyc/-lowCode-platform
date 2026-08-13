import {
  Fragment,
  defineComponent,
  h,
  provide,
  type Component,
  type PropType,
  type VNode,
} from 'vue'
import type { PageNode, PageSchema } from '@lowcode/schema'
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
  const node = ctx.schema.nodes.find((n) => n.id === nodeId)
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
}

export interface RuntimeRendererProps {
  schema: PageSchema
  context: RuntimeContext
  /** 编辑器用 wrapNode 包一层选择/悬停/落点覆盖层 */
  wrapNode?: (node: PageNode, inner: VNode) => VNode
}

/** 渲染器组件：接收 schema + 运行时上下文 */
export const RuntimeRenderer = defineComponent({
  name: 'RuntimeRenderer',
  props: {
    schema: { type: Object as PropType<PageSchema>, required: true },
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
      const children = props.schema.nodes
        .map((node) => renderNode(node.id, props.context, wrap))
        .filter(Boolean) as VNode[]
      return h('div', { class: 'lc-runtime-root' }, children)
    }
  },
})
