# 场景 10：Runtime Renderer

## 1. 场景

一份 PageSchema 在编辑器和独立预览中渲染出完全一致的页面。

## 2. 最终效果

编辑器改 schema → 运行时立即按新 schema 渲染；同一 schema 在预览页独立运行，具备数据源加载、事件、表达式、弹窗等全部能力。

## 3. 完整链路

```text
PageSchema
  → RuntimeRenderer（递归）
  → 节点 → Material Registry → Component Resolver
  → Vue 组件
  → Props（Binding 求值）
  → Events（动作链绑定）
  → Children / Slots
  → 最终 UI
```

## 4. 核心数据结构

```ts
interface RuntimeRendererProps {
  schema: PageSchema
  context: RuntimeContext
  wrapNode?: (node: PageNode, inner: VNode) => VNode
}
```

## 5. 核心接口

```ts
interface IComponentResolver {
  resolve(type: string): unknown
  has(type: string): boolean
}

class RuntimeContext {
  resolveProp(node, prop, loop?): unknown
  resolveVisible(node, loop?): boolean
  resolveLoop(node): LoopResolution | null
  resolveStyle(node, loop?): Record<string, string | number>
}
```

## 6. 工业实现

Renderer 用纯 `h()` render 函数递归渲染（无模板），支持 visible（v-if 语义）、loop（v-for 语义，循环上下文传给子树）、事件绑定（onClick → 动作链）、具名插槽、内联样式。编辑器通过 `wrapNode` 注入选择/悬停/拖拽层，Runtime 本身完全不知道编辑器的存在。

## 7. 关键代码

```ts
function renderNode(nodeId, ctx, wrap, loop, depth) {
  const node = ctx.schema.nodes.find((n) => n.id === nodeId)
  if (!node || !ctx.resolveVisible(node, loop)) return null
  const loopRes = ctx.resolveLoop(node)
  if (loopRes) {
    return h(Fragment, loopRes.items.map((item, index) =>
      buildNode(node, ctx, wrap, { itemName, indexName, item, index }, depth + 1)))
  }
  return buildNode(node, ctx, wrap, loop, depth)
}
```

## 8. 调用链

```text
render → resolveVisible → resolveLoop → buildNode → resolver.resolve → h(component, props, slots) → VNode 树 → patch → DOM
```

## 9. 数据流

```text
Schema 节点 → 绑定求值 → 组件 props → 渲染 → 交互事件 → 动作链 → 状态 → 重新渲染
```

## 10. 状态变化

- schema 引用变化 → 重新渲染；运行时变量/数据源变化 → 表达式重新求值。

## 11. 模块协作

MaterialRegistry 提供组件、Resolver 解耦类型与实现、RuntimeContext 汇聚运行时能力、Renderer 只做「翻译」。编辑器与预览共用同一套渲染器，保证 WYSIWYG。

## 12. 扩展点

- 远程物料：扩展 Resolver（组合模式已支持多解析器）。
- 自定义渲染策略：替换 wrapNode 或整体替换 RuntimeRenderer。

## 13. 面试表达

> Renderer 是整个系统的闭环：它把 PageSchema 递归翻译成 VNode 树，props 全部经过 Binding 求值，事件绑定到动作链，循环与可见性对应 v-for / v-if 语义。编辑器通过 wrapNode 注入编辑能力，因此同一渲染器同时服务编辑与预览，schema 是唯一事实来源。
