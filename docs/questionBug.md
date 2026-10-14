# 问题记录

## question1：拖入根画布后组件名/拖拽手柄被遮挡

### 现象

从物料面板将组件拖入画布根节点（非拖入父组件）时，无论 PC、Pad 还是 H5 模式，组件的名字标签与拖拽手柄都会被遮挡或裁掉。

### 根因

根级组件直接放置在画布内容区中，而画布没有内部留白。组件名和拖拽手柄是溢出节点外部的浮层：

- 组件名定位在节点上方约 18px 处；
- 拖拽手柄定位在节点右上角，向上约 11px、向右约 11px；
- 选中节点的操作按钮定位在节点下方约 26px 处。

当根级组件贴着画布上边缘/右边缘时，这些浮层会超出画布裁剪区域，分别被工具栏、属性面板或 Pad/H5 的设备边框遮挡。子组件拖入父组件时因为有父容器的内边距/间距，所以不存在该问题。

### 修复

在 `packages/editor/src/designer/components/Canvas.vue` 中为 `.lc-canvas`（PC/Pad/H5 共用）增加内边距，为节点外浮层留出空间：

```css
.lc-canvas {
  background: #fff;
  box-sizing: border-box;
  /* 为节点外浮层（组件名/拖拽手柄等）留出空间，避免贴边被画布裁剪 */
  padding: 24px;
}
```

### 验证

- 无头 Chrome 分别在 PC / Pad / H5 下复现“从物料面板拖入空根画布”：修复前组件名与拖拽手柄均超出画布范围，修复后均完整位于画布内。
- `pnpm --filter @lowcode/editor test`：17 个测试全部通过。
- `pnpm --filter @lowcode/editor typecheck`：通过。

## question2：点击上移/下移箭头移动组件后，组件会被“激活”（误选中相邻组件）

### 现象

选中画布中的组件后，点击其右下角操作条上的“↑ 上移”或“↓ 下移”，组件排序完成后，选中态（蓝色边框 + 操作条）会跳到相邻组件上：

- 上移时选中态跳到原位置的下一个组件；
- 继续点击时选中态在相邻组件之间来回跳。

即“移动组件”这个操作会意外改变当前选中/激活的组件。

### 根因

`packages/runtime/src/renderer.ts` 递归渲染节点时，`wrap(node, vnode)` 产出的兄弟节点 vnode 没有 `key`。Vue 对无 key 的兄弟列表按数组下标做 diff/patch，节点重排（上移/下移/拖拽排序）时会按位置复用 DOM 元素，而不是移动 DOM。

于是点击箭头触发的 `moveNodeUp` / `moveNodeDown` 会在这次 `click` 事件仍在冒泡的过程中改写 schema 并触发重渲染；重渲染后，操作按钮所在的 DOM 子树会被“复用”给相邻节点。事件继续沿这条被改写过的祖先链冒泡，最终命中相邻节点包裹层的 `onClick`（`selectNode(node.id)`），导致选中态跳到相邻组件。

合成 `button.click()` 只跑一次同步事件、不会命中该问题；真实鼠标点击（按下/抬起分离，重渲染夹在事件分发中间）可稳定复现。

### 修复

在 `packages/runtime/src/renderer.ts` 为渲染出的每个节点 vnode 设置稳定 `key`（`node.id`）：

- `buildNode` 中给 `wrap(...)` 的结果设置 `wrapped.key = node.id`；
- 循环渲染的 `Fragment` 同样设置 `fragment.key = node.id`，其子项使用 `${node.id}:${index}` 保证唯一；
- 未注册物料 / 渲染失败的占位节点也补上 `key`。

这样重排时 Vue 会按 key 移动同一棵 DOM 子树，操作按钮的祖先链保持稳定，`click` 冒泡到 `.lc-node__actions` 的 `stopPropagation` 即被截断，不会命中相邻节点的 `onClick`。

### 验证

- 无头 Chrome + CDP 真实鼠标事件复现：修复前点击“上移”，选中态从 `n_button` 跳到 `n_table`；修复后连续上移/下移，选中态始终停留在被移动组件上。
- 临时移除 `key` 复测，问题稳定复现，确认因果关系。
- `pnpm -r test`：全部通过（core 164 / runtime 31 / editor 17 / playground 6）。
- `pnpm --filter @lowcode/runtime typecheck`、`pnpm --filter @lowcode/editor typecheck`：通过。

## question3：刷新后点击“上移/下移”要两次才会移动

### 现象

每次刷新页面后，选中某个组件并点击一次“↑ 上移”或“↓ 下移”，组件在画布上没有任何位置变化；需要再点一次才会看到移动。

以示例页为例：选中“表格”（`n_table`）点上移，第一次点击无效，第二次才移动到“下拉框”上方。

### 根因

“上移/下移”每次只按 schema 里的兄弟顺序移动**一个位置**，而画布上有些兄弟节点并不会渲染出来（例如 `visible` 绑定为假的 `n_input`）。这些“看不见的兄弟”仍然占着顺序槽位：

```
初始 children: [n_title, n_select, n_input(隐藏), n_table, ...]
第一次上移：n_table 与 n_input 交换 → [.., n_select, n_table, n_input, ..]
```

由于 `n_input` 不渲染，第一次上移在画布上的可见顺序没有变化，看起来就像“没反应”；第二次上移越过 `n_select`，才产生可见位移。刷新后隐藏节点回到原位，所以每次刷新都会重现。

### 修复

让上移/下移**跳过画布上不渲染的兄弟节点**，一次点击对应一个“可见位置”的变化：

- `packages/editor/src/engine/editor-engine.ts`：`moveNodeUp` / `moveNodeDown` / `canMoveUp` / `canMoveDown` 增加可选 `isVisible` 参数，内部用 `siblingTarget()` 查找同方向上最近的可见兄弟；无该参数时仍是逐个移动（保持原行为与既有测试）。
- `packages/editor/src/designer/useDesigner.ts`：新增 `isRenderable()`（`meta.hidden` 或 `visible` 绑定为假 → 不渲染），并把它传给上面的方法。
- `packages/editor/src/designer/components/Canvas.vue`：操作条只在选中时渲染，未选中节点不再计算 `upEnabled/downEnabled`，避免逐节点求值可见性的开销。

### 验证

- 无头 Chrome + 真实鼠标事件：修复前 `n_table` 第一次上移可见顺序不变、第二次才变；修复后第一次上移即移动到 `n_select` 上方，第二次移动到 `n_title` 上方，第三次（已到顶）按钮置灰。
- 遍历示例页各节点/方向：`n_title` 上移、`n_button` 下移正确置灰，其余除下拉框外均一次点击即移动。
- 新增 `editor-engine.test.ts` 用例覆盖“跳过不可见兄弟”。
- `pnpm -r test`：全部通过（schema 30 / codegen 6 / core 164 / runtime 31 / editor 18 / playground 6）。
- `pnpm -r typecheck`：通过。

### 遗留

下拉框（`n_select`）等物料点击会弹出下拉浮层，浮层 `z-index` 高于画布操作条，会遮住“上移/下移”导致点不到（属于独立问题，未在本次修复范围内）。
