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
