import {
  DragDropManager,
  HistoryManager,
  NodeFactory,
  NodeTree,
  createUniqueName,
  type DropTarget,
  type HistoryOptions,
} from '@lowcode/core'
import {
  cloneSchema,
  normalizePageSchema,
  type AnyPageSchema,
  type Binding,
  type PageNode,
  type PageSchema,
} from '@lowcode/schema'
import { RuntimeContext, type RuntimeContextOptions } from '@lowcode/runtime'
import { applyDuplicate, applyGroup, applyPaste, applyUngroup } from './node-ops'
import type { DragState } from './types'

export interface EditorEngineOptions {
  schema: AnyPageSchema
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
  /** 原始输入（统一或旧版），保存时保留原结构 */
  private sourceSchema: AnyPageSchema
  private currentSchema: PageSchema
  private readonly history: HistoryManager
  private readonly runtimeOptions: Omit<RuntimeContextOptions, 'schema'>
  private readonly nodeFactory: NodeFactory
  private readonly dragDropManager: DragDropManager
  private runtimeContext: RuntimeContext

  constructor(options: EditorEngineOptions) {
    this.sourceSchema = options.schema
    this.currentSchema = normalizePageSchema(cloneSchema(options.schema))
    this.history = new HistoryManager(this.currentSchema, options.history)
    this.runtimeOptions = options.runtime
    this.nodeFactory = options.nodeFactory
    this.dragDropManager = options.dragDropManager
    this.runtimeContext = this.createRuntime()
  }

  get current(): PageSchema {
    return this.currentSchema
  }

  /** 编辑器接收的原始页面 Schema（可能是统一结构） */
  get source(): AnyPageSchema {
    return this.sourceSchema
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

  load(schema: AnyPageSchema): void {
    this.sourceSchema = schema
    this.currentSchema = normalizePageSchema(cloneSchema(schema))
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
    // schema 变更后重建运行时，保证 RuntimeRenderer 消费到最新节点树
    this.runtimeContext = this.createRuntime()
    return this.currentSchema
  }

  undo(): PageSchema | undefined {
    const next = this.history.undo()
    if (next) {
      this.currentSchema = next
      this.runtimeContext = this.createRuntime()
    }
    return next
  }

  redo(): PageSchema | undefined {
    const next = this.history.redo()
    if (next) {
      this.currentSchema = next
      this.runtimeContext = this.createRuntime()
    }
    return next
  }

  /** 清空画布（移除全部节点） */
  clear(): void {
    this.record((draft) => {
      draft.nodes = []
    }, 'clear')
  }

  insertMaterial(type: string, target: DropTarget): PageNode {
    const node = this.nodeFactory.create(type)
    // name 全局唯一：工厂生成的名称与现有节点冲突时重新生成
    const taken = new Set(this.currentSchema.nodes.map((n) => n.name ?? n.id))
    if (!node.name || taken.has(node.name)) {
      node.name = createUniqueName(type, taken)
    }
    taken.add(node.name)
    // label 初始值等于 name（仅对声明了 label 展示字段的物料生效，如卡片）
    if ('label' in node.props) {
      node.props.label = node.name
    }
    this.record((draft) => {
      new NodeTree(draft.nodes).insert(node, target.parentId, target.slot, target.index)
    }, 'insert')
    return node
  }

  /** 同级上移一位（已在首位时无操作） */
  moveNodeUp(nodeId: string): void {
    this.record((draft) => {
      const tree = new NodeTree(draft.nodes)
      const position = tree.getPosition(nodeId)
      if (position.index > 0) {
        tree.move(nodeId, {
          parentId: position.parentId,
          slot: position.slot,
          index: position.index - 1,
        })
      }
    }, 'moveUp')
  }

  /** 同级下移一位（已在末位时无操作） */
  moveNodeDown(nodeId: string): void {
    this.record((draft) => {
      const tree = new NodeTree(draft.nodes)
      const position = tree.getPosition(nodeId)
      if (position.index >= 0 && position.index < position.siblingIds.length - 1) {
        tree.move(nodeId, {
          parentId: position.parentId,
          slot: position.slot,
          index: position.index + 1,
        })
      }
    }, 'moveDown')
  }

  /** 深复制节点子树（生成新 id / name），插入到源节点紧邻后方 */
  duplicate(nodeId: string): PageNode[] {
    const inserted: PageNode[] = []
    this.record((draft) => {
      inserted.push(...applyDuplicate(new NodeTree(draft.nodes), nodeId))
    }, 'duplicate')
    return inserted
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
