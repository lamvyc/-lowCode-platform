# 场景 1：拖拽物料到画布

## 1. 场景

用户把 Button 从物料面板拖到画布中间。

## 2. 最终效果

画布中间出现一个 Button，右侧属性面板自动选中它；Ctrl+Z 可以撤销这次插入。

## 3. 完整链路

```text
物料面板 dragstart
  → DragPayload
  → Canvas 节点 dragover
  → DragDropManager.computeDropTarget
  → NodeFactory.create
  → NodeTree.insert
  → History.record（Immer 补丁）
  → PageSchema 更新
  → Runtime Renderer
  → 画布出现 Button
```

## 4. 核心数据结构

```ts
interface DragPayload {
  source: 'material' | 'canvas'
  materialType?: string
  nodeId?: string
}

interface DropTarget {
  parentId: string | null
  slot?: string
  position: 'before' | 'after' | 'inside' | 'root'
  index: number
  targetId?: string
}
```

## 5. 核心接口

```ts
class DragDropManager {
  computeDropTarget(tree, payload, over, pointer, rootRect?): DropTarget
  validateDrop(tree, payload, target): { ok: boolean; reason?: string }
}

class NodeFactory {
  create(type: string, overrides?): PageNode  // 应用物料 defaultProps
}
```

## 6. 工业实现

- 物料面板：原生 `draggable` + `dragstart`（无需第三方库）。
- 落点计算：`DragDropManager` 纯几何计算（指针在节点 rect 的 1/3 位置决定 before/after/inside）。
- 历史：`HistoryManager` 基于 Immer `produceWithPatches`，一次插入 = 一个可撤销步骤。
- `vuedraggable` 集成在大纲面板（根级重排），`vue3-grid-layout` 由 `core/layout/grid.ts` 的数学适配器覆盖。

## 7. 关键代码

```ts
function onDrop() {
  const target = store.dropTarget
  const drag = store.dragState
  if (target && drag?.materialType) {
    store.insertMaterial(drag.materialType, target)
  }
}

insertMaterial(type: string, target: DropTarget) {
  const node = nodeFactory.create(type)
  this.commit((draft) => {
    new NodeTree(draft.nodes).insert(node, target.parentId, target.slot, target.index)
  }, 'insert')
  this.selectedNodeIds = [node.id]
}
```

## 8. 调用链

```text
onDragStart()
→ setDragState()
→ CanvasNode.onNodeDragOver()
→ DragDropManager.computeDropTarget()
→ onDrop()
→ insertMaterial()
→ HistoryManager.record()
→ RuntimeRenderer 重渲染
```

## 9. 数据流

```text
DragPayload → DropTarget（几何转结构）→ PageNode（默认属性填充）→ schema.nodes → VNode → DOM
```

## 10. 状态变化

- Pinia：`dragState`、`dropTarget`、`selectedNodeIds`。
- PageSchema：`nodes` 新增一个节点，父级 `children` 追加 id。
- History：undo 栈 +1，redo 栈清空。

## 11. 模块协作

物料面板负责发起、画布负责接收、DragDropManager 负责把像素变成结构、NodeFactory 负责生成节点、NodeTree 负责维护父子引用、History 负责可撤销、Renderer 负责呈现。每个模块只做一件事。

## 12. 扩展点

- 新物料：注册进 `MaterialRegistry` 即可，无需改拖拽逻辑。
- 新落点语义（如网格吸附）：扩展 `DragDropManager` 或替换 `computeDropTarget` 策略。
- 新容器插槽：`DropTarget.slot` 已支持，NodeTree 按 slot 维护子列表。

## 13. 面试表达

> 拖拽的核心是把「指针坐标」这个几何信息，通过 DragDropManager 转成结构化的 DropTarget（父节点 + 位置 + 下标），再由 NodeFactory 用物料默认属性生成节点、NodeTree 维护树引用，最后所有修改都经过 HistoryManager 的 Immer 补丁入栈，保证可撤销。Renderer 只消费 schema，因此编辑器改 schema、运行时渲染 schema，两者完全解耦。
