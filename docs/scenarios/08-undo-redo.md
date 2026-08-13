# 场景 8：Undo / Redo

## 1. 场景

用户修改 Button 文案后按 Ctrl+Z，文案恢复；再按 Ctrl+Y 重做。

## 2. 最终效果

所有 schema 修改都可撤销/重做；连续输入被合并为一次撤销；历史深度有上限。

## 3. 完整链路

```text
修改属性 → NodeTree.updateProps
  → HistoryManager.record（Immer produceWithPatches）
  → 补丁 + 反向补丁入栈
  → Ctrl+Z → undo
  → applyPatches(inversePatches)
  → PageSchema 恢复
  → Renderer 更新
```

## 4. 核心数据结构

```ts
interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
  op?: string
  timestamp: number
  mergeKey?: string
}
```

## 5. 核心接口

```ts
class HistoryManager {
  record(recipe: (draft: PageSchema) => void, op?, mergeKey?): PageSchema
  undo(): PageSchema | undefined
  redo(): PageSchema | undefined
  get canUndo(): boolean
  get canRedo(): boolean
}
```

## 6. 工业实现

- Immer `produceWithPatches` 自动生成补丁与反向补丁，无需手写撤销逻辑。
- mergeKey：相同 key 在 800ms 窗口内合并（正向补丁拼接、反向补丁倒序拼接）。
- maxDepth 限制栈深度，避免内存无限增长。
- 批量：一次 recipe 内多次修改 = 一条历史。

## 7. 关键代码

```ts
record(recipe, op, mergeKey) {
  const [next, patches, inversePatches] = produceWithPatches(this.currentSchema, recipe)
  if (patches.length === 0) return this.currentSchema
  if (mergeKey && top?.mergeKey === mergeKey && now - top.timestamp <= mergeWindowMs) {
    top.patches = [...top.patches, ...patches]
    top.inversePatches = [...inversePatches, ...top.inversePatches]
  } else {
    this.undoStack.push({ patches, inversePatches, op, timestamp: now, mergeKey })
  }
  this.redoStack = []
  this.currentSchema = next
}
```

## 8. 调用链

```text
输入 → commit → record → 补丁入栈 → Ctrl+Z → undo → applyPatches → schema 替换 → Renderer
```

## 9. 数据流

```text
旧 schema → produceWithPatches → 新 schema + 补丁对 → 栈 → 应用反向补丁 → 旧状态
```

## 10. 状态变化

- undo 栈 / redo 栈；currentSchema 引用。

## 11. 模块协作

Editor 所有修改强制走 commit（历史入口）；NodeTree 提供树操作；Immer 提供补丁；Renderer 无感知地消费新 schema。这个「单一入口」约定是历史系统可靠的前提。

## 12. 扩展点

- 操作合并策略：扩展 mergeKey 语义（如按动作类型合并）。
- 分支历史（undo 后产生新修改）已有 redo 栈清空逻辑。

## 13. 面试表达

> 撤销重做我用 Immer 的补丁机制实现：每次修改都在 produce 中产生补丁对，undo 应用反向补丁、redo 应用正向补丁。连续输入通过 mergeKey 合并成一次撤销，配合 maxDepth 控制内存。关键设计是所有修改必须经过历史入口，否则无法保证可撤销。
