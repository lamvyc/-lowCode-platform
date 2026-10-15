import {
  Fragment,
  defineComponent,
  h,
  provide,
  shallowRef,
  watch,
  watchEffect,
  type Component,
  type PropType,
  type VNode,
} from 'vue'
import type { AnyPageSchema, PageNode } from '@lowcode/schema'
import { RUNTIME_CONTEXT_KEY, type RuntimeContext } from './context'
import { FIELD_CONTEXT_KEY, type FieldContext } from './field'

type LoopCtx = { itemName: string; indexName?: string; item: unknown; index: number }

/** DOM 事件名 → Vue onXxx 属性名 */
function toOnProp(eventName: string): string {
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`
}

/** 深度：防止 schema 异常导致无限递归 */
const MAX_DEPTH = 32

/**
 * 为字段节点提供身份上下文，不改动 DOM 结构（只多一层无渲染的组件实例）。
 * 物料侧通过 `useFieldContext()` 注入，从而知道自己是哪个节点。
 */
const FieldContextProvider = defineComponent({
  name: 'LcFieldContext',
  props: {
    nodeId: { type: String, required: true },
    fieldName: { type: String, required: true },
  },
  setup(props, { slots }) {
    provide(FIELD_CONTEXT_KEY, props as FieldContext)
    return () => slots.default?.()
  },
})

/** renderNode 的可选参数 */
export interface RenderNodeOptions {
  loop?: LoopCtx
  depth?: number
  /**
   * 设计态渲染：**不自动校验**（对应参考实现"画布不做即时校验"——它的画布里没有 `el-form` 父级，
   * `el-form-item` 无法校验）。值同步照常进行，只是不产生错误提示。
   */
  designMode?: boolean
}

/**
 * Runtime Renderer：消费 PageSchema 并递归渲染整棵节点树。
 * 关键闭环：Schema → Resolver → Vue 组件 → Props/Bindings/Events → Children/Slots → UI
 *
 * 注意：声明了 `modelValue` 的字段节点会被额外包一层 `FieldContextProvider`
 * （用于向物料 provide 节点身份）。因此对字段节点，返回的 vnode **不是**物料组件本身的 vnode，
 * 其 `children.default()` 才是；非字段节点则直接返回物料 vnode。
 */
export function renderNode(
  nodeId: string,
  ctx: RuntimeContext,
  wrap: (node: PageNode, inner: VNode) => VNode,
  options: RenderNodeOptions = {},
): VNode | null {
  const { loop, depth = 0, designMode = false } = options
  if (depth > MAX_DEPTH) return null
  // O(1) 节点索引查找，替代 O(n) 线性扫描（500 组件页从 25 万次查找降到 500 次）
  const node = ctx.getNode(nodeId)
  if (!node) return null
  if (ctx.resolveHidden(node)) return null
  if (!ctx.resolveVisible(node, loop)) return null

  const loopResolution = ctx.resolveLoop(node)
  if (loopResolution) {
    const vnodes: VNode[] = []
    loopResolution.items.forEach((item, index) => {
      // 循环节点本体渲染一次，循环上下文传给它的内容子树
      const child = buildNode(node, ctx, wrap, {
        loop: {
          itemName: loopResolution.itemName,
          indexName: loopResolution.indexName,
          item,
          index,
        },
        depth: depth + 1,
        designMode,
      })
      if (child) {
        // 循环项共用同一个 node.id，需带上下标避免 key 重复
        child.key = `${node.id}:${index}`
        vnodes.push(child)
      }
    })
    const fragment = h(Fragment, vnodes)
    // Fragment 自身也要 key：循环节点与非循环兄弟节点重排时同样需要稳定复用
    fragment.key = node.id
    return fragment
  }

  return buildNode(node, ctx, wrap, options)
}

function buildNode(
  node: PageNode,
  ctx: RuntimeContext,
  wrap: (node: PageNode, inner: VNode) => VNode,
  options: RenderNodeOptions,
): VNode | null {
  const { loop, depth = 0, designMode = false } = options
  try {
    const component = ctx.resolver.resolve(node.type)
    if (!component) {
      return h(
        'div',
        { key: node.id, class: 'lc-missing', 'data-node-id': node.id, 'data-node-type': node.type },
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

    // 字段节点（声明了 modelValue 的）额外接线：
    //   1. v-model 写回：值落到运行时值存储（setNodeValue），**不写回 schema**
    //   2. 校验触发：blur / change 后重算该字段的错误
    // 在这里一次性接线，而不是改 28 个物料——跨切面关注点放在渲染器里最省。
    const isField = 'modelValue' in node.props
    if (isField) {
      props['onUpdate:modelValue'] = (value: unknown) => {
        ctx.setNodeValue(node.id, value)
      }

      if (!designMode) {
        // change 时不过滤规则（跑全部）：这是参考实现 handleChangeEvent 之后显式
        // validateField 的语义，用于**清掉已经过期的必填错误**（用户把空值填上了）。
        const declaredChange = props.onChange as ((value: unknown) => void) | undefined
        props.onChange = (value: unknown) => {
          declaredChange?.(value)
          ctx.validateField(node.id)
        }
        // blur 按 blur 触发时机过滤（必填与格式校验都含 blur，净效果同样是跑全部规则）
        const declaredBlur = props.onBlur as ((event: unknown) => void) | undefined
        props.onBlur = (event: unknown) => {
          declaredBlur?.(event)
          ctx.validateField(node.id, 'blur')
        }
      }
    }

    // Children / Slots
    const childrenIds = node.children ?? []
    const childOptions: RenderNodeOptions = { loop, depth: depth + 1, designMode }
    const renderChild = (id: string): VNode | null => renderNode(id, ctx, wrap, childOptions)
    const defaultSlot = childrenIds.map(renderChild).filter(Boolean) as VNode[]
    const slots: Record<string, () => VNode[]> = { default: () => defaultSlot }
    for (const [slotName, ids] of Object.entries(node.slots ?? {})) {
      // 默认插槽以 children 为准：物料声明 slots: ['default'] 时 NodeFactory 会初始化
      // `slots.default = []`，若在此覆盖会导致容器子节点全部不渲染
      if (slotName === 'default') continue
      slots[slotName] = () =>
        ids.map(renderChild).filter(Boolean) as VNode[]
    }

    const componentVNode = h(component as Component, props, slots)
    // 字段节点包一层无渲染的 provider，让物料侧（含 FormItem 外壳）能拿到自己的节点身份。
    // ⚠️ 必须用独立的 const 捕获组件 vnode：若写成 `let vnode = h(...); vnode = h(Provider, {}, {default: () => vnode})`，
    // 插槽闭包读到的是被重新赋值后的 vnode（即 provider 自己），会无限递归。
    const vnode = isField
      ? h(
          FieldContextProvider,
          { nodeId: node.id, fieldName: node.name ?? node.id },
          { default: () => componentVNode },
        )
      : componentVNode
    const wrapped = wrap(node, vnode)
    // 稳定 key：节点重排（上移/下移/拖拽排序）时，Vue 会按 key 移动/复用对应 DOM，
    // 而不是按数组下标把 DOM 元素错配给相邻节点。否则在“点击上移/下移”这次事件的
    // 冒泡过程中，操作按钮所在的子树会被复用给别的节点，事件冒泡最终命中的是
    // 相邻节点的包裹层 onClick，于是被移动组件错选成相邻组件。
    wrapped.key = node.id
    return wrapped
  } catch (error) {
    // 容错降级（E4）：单节点渲染失败不拖垮整页，渲染占位并记录错误上下文
    const message = error instanceof Error ? error.message : String(error)
    ctx.errors.add(
      { scope: 'render', message, nodeId: node.id },
      `render:${node.id}`,
    )
    return h(
      'div',
      {
        key: node.id,
        class: 'lc-render-error',
        'data-node-id': node.id,
        'data-node-type': node.type,
      },
      `[渲染失败: ${message}]`,
    )
  }
}

export interface RuntimeRendererProps {
  schema: AnyPageSchema
  context: RuntimeContext
  /** 编辑器用 wrapNode 包一层选择/悬停/落点覆盖层 */
  wrapNode?: (node: PageNode, inner: VNode) => VNode
  /**
   * 设计态渲染：不自动校验（对应参考实现"画布不做即时校验"）。
   * 画布传 `true`；预览与运行时宿主用默认值 `false`。
   */
  designMode?: boolean
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
    designMode: { type: Boolean, default: false },
  },
  setup(props) {
    // provide 只在 setup 里执行一次。编辑器每次 schema 变更都会重建 RuntimeContext
    // （EditorEngine.record），若直接 provide 对象，下游 useRuntimeContext() 会一直
    // 拿到第一次的旧上下文——表现为改「表单设置」后画布上的字段标签不更新。
    // 因此 provide 一个 ref，并在上下文变化时同步。
    const contextRef = shallowRef(props.context)
    watchEffect(() => {
      contextRef.value = props.context
    })
    provide(RUNTIME_CONTEXT_KEY, contextRef)

    // 切回设计态时清掉遗留错误：设计器与预览**共用同一个 RuntimeContext**
    // （Designer.vue 的预览分支直接复用 ctx.runtime），所以预览里校验出的错误会留在
    // 同一个 fieldErrors 里。进设计态就清掉，避免画布上残留红字。
    //
    // ⚠️ 这里必须用 `watch(getter, cb)` 而不是 `watchEffect`：
    // watchEffect 会把回调里读到的 fieldErrors 键也纳入依赖，于是**每次错误变化都会重跑**，
    // 把刚校验出来的错误立刻清掉，下面的 `if (!designMode)` 守卫就形同虚设。
    // watch 只追踪 getter 里的 designMode，回调内的读取不建立依赖。
    watch(
      () => props.designMode,
      (isDesignMode) => {
        if (isDesignMode) props.context.clearFieldErrors()
      },
      { immediate: true },
    )

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
        const renderOptions: RenderNodeOptions = { designMode: props.designMode }
        const children = rootIds
          .map((id) => renderNode(id, props.context, wrap, renderOptions))
          .filter(Boolean) as VNode[]
        props.context.metrics.increment('render.nodes', children.length)
        return h('div', { class: 'lc-runtime-root' }, children)
      } finally {
        end()
      }
    }
  },
})
