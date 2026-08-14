# EditorEngine 抽取与 Paste/Group/Ungroup 纯函数化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `@lowcode/editor` 的 schema/history/runtime 从 Pinia store 抽到可单测的 `EditorEngine`，并把 paste/group/ungroup 抽成纯函数。

**Architecture:** `EditorEngine` 是纯 TypeScript 类，持有 `PageSchema`、`HistoryManager`、`RuntimeContext` 和 schema 修改方法；Pinia store 只保存视图状态并同步 `schema`。纯函数 `applyPaste/applyGroup/applyUngroup` 直接操作 `NodeTree`，由 engine 在 Immer recipe 内调用。

**Tech Stack:** TypeScript strict, Pinia, Vue 3, Vitest, Immer。

---

## File Structure

- Create: `packages/editor/src/engine/types.ts`
- Create: `packages/editor/src/engine/node-ops.ts`
- Create: `packages/editor/src/engine/editor-engine.ts`
- Create: `packages/editor/src/engine/node-ops.test.ts`
- Create: `packages/editor/vitest.config.ts`
- Modify: `packages/editor/src/store/editor.ts`
- Modify: `packages/editor/package.json`
- Modify: `vitest.workspace.ts`

## Task 1: 添加 editor 测试基础设施

**Files:**
- Create: `packages/editor/vitest.config.ts`
- Modify: `packages/editor/package.json`
- Modify: `vitest.workspace.ts`

- [ ] **Step 1: 创建 Vitest 配置**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: 添加 test 脚本**

在 `packages/editor/package.json` 的 `scripts` 中增加：

```json
"test": "vitest run"
```

- [ ] **Step 3: 把 editor 纳入 workspace**

在 `vitest.workspace.ts` 中增加：

```ts
'packages/editor/vitest.config.ts',
```

- [ ] **Step 4: 验证**

Run: `pnpm --filter @lowcode/editor test`
Expected: `No test files found` 或空跑成功。

## Task 2: 抽取 drag 状态类型

**Files:**
- Create: `packages/editor/src/engine/types.ts`

- [ ] **Step 1: 创建类型**

```ts
export interface DragState {
  source: 'material' | 'canvas'
  materialType?: string
  nodeId?: string
}
```

## Task 3: 纯函数化 Paste/Group/Ungroup

**Files:**
- Create: `packages/editor/src/engine/node-ops.ts`
- Test: `packages/editor/src/engine/node-ops.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { NodeTree } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'
import { applyGroup, applyPaste, applyUngroup } from './node-ops'

function nodes(): PageNode[] {
  return [
    { id: 'root', type: 'container', props: {}, children: ['a', 'b'] },
    { id: 'a', type: 'button', props: { text: 'A' } },
    { id: 'b', type: 'container', props: {}, children: ['c'] },
    { id: 'c', type: 'input', props: {} },
  ]
}

describe('editor node-ops', () => {
  it('applyGroup 把多个节点组合进容器', () => {
    const tree = new NodeTree(nodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }
    applyGroup(tree, ['a', 'b'], container)
    expect(tree.get('group1').children).toEqual(['a', 'b'])
    expect(tree.getParent('a')?.node.id).toBe('group1')
  })

  it('applyUngroup 移除容器并恢复子节点', () => {
    const tree = new NodeTree(nodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }
    applyGroup(tree, ['a', 'b'], container)
    applyUngroup(tree, 'group1')
    expect(tree.find('group1')).toBeUndefined()
    expect(tree.getParent('a')).toBeUndefined()
    expect(tree.getParent('b')).toBeUndefined()
  })

  it('applyPaste 复制粘贴时生成新 id 且不改原节点', () => {
    const tree = new NodeTree(nodes())
    const inserted = applyPaste(tree, [
      { id: 'copy', type: 'button', props: { text: '复制' } },
    ])
    expect(inserted).toHaveLength(1)
    expect(inserted[0].id).not.toBe('copy')
    expect(tree.find('copy')).toBeUndefined()
    expect(tree.find(inserted[0].id)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @lowcode/editor test -- src/engine/node-ops.test.ts`
Expected: FAIL，`Cannot find module './node-ops'`。

- [ ] **Step 3: 实现纯函数**

```ts
import { NodeTree, createNodeId } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'

function cloneNode(node: PageNode): PageNode {
  return JSON.parse(JSON.stringify(node)) as PageNode
}

export function applyGroup(
  tree: NodeTree,
  ids: string[],
  container: PageNode,
): PageNode {
  return tree.groupAs(ids, container)
}

export function applyUngroup(tree: NodeTree, containerId: string): PageNode[] {
  const container = tree.find(containerId)
  if (!container?.children?.length) return []
  return tree.ungroup(containerId)
}

export function applyPaste(tree: NodeTree, source: PageNode[]): PageNode[] {
  if (source.length === 0) return []

  const idMap = new Map<string, string>()
  const buildMap = (node: PageNode) => {
    idMap.set(node.id, createNodeId())
    for (const childId of node.children ?? []) {
      const child = source.find((n) => n.id === childId)
      if (child) buildMap(child)
    }
  }
  for (const node of source) buildMap(node)

  const plan: { source: PageNode; newParentId: string | null }[] = []
  const collect = (node: PageNode, newParentId: string | null) => {
    plan.push({ source: node, newParentId })
    for (const childId of node.children ?? []) {
      const child = source.find((n) => n.id === childId)
      if (child) collect(child, idMap.get(node.id) ?? '')
    }
  }
  for (const node of source) collect(node, null)

  const inserted: PageNode[] = []
  for (const item of plan) {
    const newNode: PageNode = {
      ...cloneNode(item.source),
      id: idMap.get(item.source.id) ?? createNodeId(),
      children: item.source.children?.map((id) => idMap.get(id) ?? id),
      slots: item.source.slots
        ? Object.fromEntries(
            Object.entries(item.source.slots).map(([slot, ids]) => [
              slot,
              ids.map((id) => idMap.get(id) ?? id),
            ]),
          )
        : undefined,
    }
    tree.insert(newNode, item.newParentId)
    inserted.push(newNode)
  }
  return inserted
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @lowcode/editor test -- src/engine/node-ops.test.ts`
Expected: PASS。

## Task 4: 实现 EditorEngine

**Files:**
- Create: `packages/editor/src/engine/editor-engine.ts`

- [ ] **Step 1: 实现类**

```ts
import {
  DragDropManager,
  HistoryManager,
  NodeFactory,
  NodeTree,
  type DropTarget,
  type HistoryOptions,
} from '@lowcode/core'
import type { Binding, PageNode, PageSchema } from '@lowcode/schema'
import { cloneSchema } from '@lowcode/schema'
import { RuntimeContext, type RuntimeContextOptions } from '@lowcode/runtime'
import { applyGroup, applyPaste, applyUngroup } from './node-ops'
import type { DragState } from './types'

export interface EditorEngineOptions {
  schema: PageSchema
  nodeFactory: NodeFactory
  dragDropManager: DragDropManager
  runtime: Omit<RuntimeContextOptions, 'schema'>
  history?: HistoryOptions
}

export interface DropOver {
  node: PageNode
  rect: { left: number; top: number; width: number; height: number }
  depth?: number
}

export class EditorEngine {
  private currentSchema: PageSchema
  private readonly history: HistoryManager
  private readonly runtimeOptions: Omit<RuntimeContextOptions, 'schema'>
  private readonly nodeFactory: NodeFactory
  private readonly dragDropManager: DragDropManager
  private runtimeContext: RuntimeContext

  constructor(options: EditorEngineOptions) {
    this.currentSchema = cloneSchema(options.schema)
    this.history = new HistoryManager(this.currentSchema, options.history)
    this.runtimeOptions = options.runtime
    this.nodeFactory = options.nodeFactory
    this.dragDropManager = options.dragDropManager
    this.runtimeContext = this.createRuntime()
  }

  get current(): PageSchema {
    return this.currentSchema
  }

  get runtime(): RuntimeContext {
    return this.runtimeContext
  }

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  load(schema: PageSchema): void {
    this.currentSchema = cloneSchema(schema)
    this.history.reset(this.currentSchema)
    this.runtimeContext = this.createRuntime()
  }

  async init(): Promise<void> {
    await this.runtimeContext.init()
  }

  record(
    recipe: (draft: PageSchema) => void,
    op?: string,
    mergeKey?: string,
  ): PageSchema {
    this.currentSchema = this.history.record(recipe, op, mergeKey)
    return this.currentSchema
  }

  undo(): PageSchema | undefined {
    const next = this.history.undo()
    if (next) this.currentSchema = next
    return next
  }

  redo(): PageSchema | undefined {
    const next = this.history.redo()
    if (next) this.currentSchema = next
    return next
  }

  insertMaterial(type: string, target: DropTarget): PageNode {
    const node = this.nodeFactory.create(type)
    this.record((draft) => {
      new NodeTree(draft.nodes).insert(node, target.parentId, target.slot, target.index)
    }, 'insert')
    return node
  }

  moveNode(nodeId: string, target: DropTarget): void {
    this.record((draft) => {
      new NodeTree(draft.nodes).move(nodeId, {
        parentId: target.parentId,
        slot: target.slot,
        index: target.index,
      })
    }, 'move')
  }

  updateProps(nodeId: string, patch: Record<string, unknown>): void {
    this.record((draft) => {
      new NodeTree(draft.nodes).updateProps(nodeId, patch)
    }, 'props', `props:${nodeId}`)
  }

  updateNode(nodeId: string, updater: (node: PageNode) => PageNode): void {
    this.record((draft) => {
      new NodeTree(draft.nodes).update(nodeId, updater)
    }, 'props', `props:${nodeId}`)
  }

  updateBinding(
    nodeId: string,
    key: 'visible' | 'loop',
    binding: Binding<unknown> | undefined,
  ): void {
    this.updateNode(nodeId, (node) => ({
      ...node,
      bindings: { ...(node.bindings ?? {}), [key]: binding },
    }))
  }

  updateStyle(nodeId: string, style: Record<string, Binding<string | number>>): void {
    this.updateNode(nodeId, (node) => ({ ...node, style }))
  }

  updateEvents(nodeId: string, events: PageNode['events']): void {
    this.updateNode(nodeId, (node) => ({ ...node, events }))
  }

  removeNodes(ids: string[]): void {
    this.record((draft) => {
      const tree = new NodeTree(draft.nodes)
      for (const id of ids) {
        if (tree.find(id)) tree.remove(id)
      }
    }, 'remove')
  }

  group(ids: string[], container: PageNode): PageNode {
    this.record((draft) => {
      applyGroup(new NodeTree(draft.nodes), ids, container)
    }, 'group')
    return container
  }

  ungroup(containerId: string): string[] {
    const ids: string[] = []
    this.record((draft) => {
      ids.push(...applyUngroup(new NodeTree(draft.nodes), containerId).map((node) => node.id))
    }, 'ungroup')
    return ids
  }

  paste(source: PageNode[]): PageNode[] {
    const inserted: PageNode[] = []
    this.record((draft) => {
      inserted.push(...applyPaste(new NodeTree(draft.nodes), source))
    }, 'paste')
    return inserted
  }

  computeDropTarget(
    dragState: DragState,
    over: DropOver | null,
    pointer: { x: number; y: number },
    rootRect?: { left: number; top: number; width: number; height: number },
  ): DropTarget | null {
    const tree = new NodeTree(this.currentSchema.nodes)
    const target = this.dragDropManager.computeDropTarget(tree, dragState, over, pointer, rootRect)
    const validation = this.dragDropManager.validateDrop(tree, dragState, target)
    return validation.ok ? target : null
  }

  private createRuntime(): RuntimeContext {
    return new RuntimeContext({ ...this.runtimeOptions, schema: this.currentSchema })
  }
}
```

## Task 5: 重构 store 委托给 EditorEngine

**Files:**
- Modify: `packages/editor/src/store/editor.ts`

- [ ] **Step 1: 替换 import 和模块级状态**

删除模块级 `editorHistory`、`editorRuntime`，改为 state 中的 `engine`。新增：

```ts
import { markRaw } from 'vue'
import { EditorEngine } from '../engine/editor-engine'
import type { DragState } from '../engine/types'
```

保留 `nodeFactory`、`dragDropManager`、`resolver` 作为平台依赖，删除 `HistoryManager`、`RuntimeContext`、`cloneSchema` 之外不再需要的导入。

- [ ] **Step 2: state/getters/actions 委托**

按以下方式修改关键 action：

```ts
state: (): EditorState => ({
  schema: null,
  engine: null,
  // ...其余视图状态不变
}),

getters: {
  runtimeContext(): RuntimeContext | null {
    return this.engine?.runtime ?? null
  },
  canUndo(): boolean {
    return this.engine?.canUndo ?? false
  },
  canRedo(): boolean {
    return this.engine?.canRedo ?? false
  },
},
```

`loadSchema`：

```ts
loadSchema(schema: PageSchema) {
  this.schema = cloneSchema(schema)
  this.selectedNodeIds = []
  this.hoverNodeId = null
  this.clipboard = null
  this.dropTarget = null
  this.dirty = false
  this.preview = false
  this.engine = markRaw(new EditorEngine({
    schema: this.schema,
    nodeFactory,
    dragDropManager,
    runtime: {
      resolver,
      actionRegistry,
      expression: expressionEngine,
      http: createFetchHttpClient(),
      storage: window.localStorage,
      onSetNodeProp: (nodeId, prop, value) => {
        this.updateProps(nodeId, { [prop]: value })
      },
      navigate: (route) => {
        window.location.hash = route
      },
      request: (config) => createFetchHttpClient().request(config),
    },
  }))
  void this.engine.init()
}
```

其余 schema 修改 action 全部改成调用 `this.engine` 后同步 `this.schema = this.engine.current`，例如：

```ts
commit(recipe, op?, mergeKey?) {
  if (!this.schema || !this.engine) return
  this.schema = this.engine.record(recipe, op, mergeKey)
  this.dirty = true
},

insertMaterial(type, target) {
  if (!this.engine) return
  const node = this.engine.insertMaterial(type, target)
  this.schema = this.engine.current
  this.selectedNodeIds = [node.id]
},

moveNode(nodeId, target) {
  if (!this.engine) return
  this.engine.moveNode(nodeId, target)
  this.schema = this.engine.current
  this.selectedNodeIds = [nodeId]
},
```

`groupSelection`、`ungroupSelection`、`paste` 使用 engine 的方法，`removeNodes` 使用 engine 后同步。

- [ ] **Step 3: 更新 `computeDropTarget`**

```ts
computeDropTarget(over, pointer, rootRect?) {
  if (!this.dragState || !this.schema || !this.engine) return null
  return this.engine.computeDropTarget(this.dragState, over, pointer, rootRect)
},
```

## Task 6: 验证与提交

- [ ] **Step 1: 运行 editor 测试**

Run: `pnpm --filter @lowcode/editor test`
Expected: node-ops 3 个测试通过。

- [ ] **Step 2: 运行 editor 类型检查**

Run: `pnpm --filter @lowcode/editor typecheck`
Expected: exit 0。

- [ ] **Step 3: 运行全仓测试**

Run: `pnpm -r test`
Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add docs/refactor-assessment.md docs/superpowers/plans/2026-08-14-editor-engine-refactor.md packages/core/src/node-tree.ts packages/core/src/node-tree.test.ts packages/core/src/history.test.ts packages/editor/src packages/editor/package.json packages/editor/vitest.config.ts vitest.workspace.ts
git commit -m "fix(core): 修复 NodeTree 就地修改契约并抽取 EditorEngine"
```
