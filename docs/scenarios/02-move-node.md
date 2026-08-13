# 场景 2：移动节点

## 1. 场景

用户把画布中的 Button 从容器 A 拖到容器 B 的指定位置。

## 2. 最终效果

Button 出现在 B 中指定下标处，A 中不再有它；可撤销。

## 3. 完整链路

```text
canvas 节点 dragstart
  → DragPayload（source: canvas, nodeId）
  → 目标节点 dragover → DropTarget
  → NodeTree.canMove（合法性校验）
  → NodeTree.move（parent / slot / index）
  → History.record
  → schema 更新 → Renderer 更新
```

## 4. 核心数据结构

```ts
interface MoveOptions {
  parentId: string | null
  slot?: string
  index?: number
  beforeId?: string
}
```

## 5. 核心接口

```ts
class NodeTree {
  canMove(id, options): { ok: boolean; reason?: string }
  move(id, options): PageNode
  getParent(id): { node: PageNode; slot?: string } | undefined
  isDescendant(id, ancestorId): boolean
}
```

## 6. 工业实现

移动前先做合法性检查，核心规则是**不能移动到自己的后代**。目标下标用 `beforeId` 或 `index` 表达；同容器移动时对删除造成的下标偏移做了修正。

## 7. 关键代码

```ts
canMove(id, options) {
  if (options.parentId === id) return { ok: false, reason: '不能移动到自身内部' }
  if (options.parentId !== null && this.isDescendant(options.parentId, id)) {
    return { ok: false, reason: '不能移动到自己的后代节点中' }
  }
  return { ok: true }
}
```

## 8. 调用链

```text
dragstart → computeDropTarget → validateDrop → store.moveNode → NodeTree.move → History.record → Renderer
```

## 9. 数据流

```text
指针位置 → DropTarget{parentId, slot, index} → 旧父级 children 移除 → 新父级 children 插入 → schema
```

## 10. 状态变化

- 旧父节点 children 变化，新父节点 children 变化，节点自身不变。
- History undo 栈 +1。

## 11. 模块协作

NodeTree 负责树结构正确性；DragDropManager 负责把「拖到哪」翻译成结构；History 保证移动可回滚；Renderer 按新结构重渲染。

## 12. 扩展点

- 容器插槽：`slot` 已进入 MoveOptions，未来支持具名插槽移动。
- 拖拽约束（如容器只允许特定类型）：在 `validateDrop` 增加规则即可。

## 13. 面试表达

> 移动节点的本质不是移动 DOM，而是维护一棵平铺引用树：先校验目标父节点不是自己的后代，再通过 detach + splice 更新 children 引用，最后把这次变更作为一条 Immer 补丁入历史。因为 schema 是唯一事实来源，撤销、重做、渲染全部自动跟随。
