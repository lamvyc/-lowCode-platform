import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import {
  DragDropManager,
  NodeFactory,
  createNodeId,
  type DropTarget,
  type HttpClient,
} from '@lowcode/core'
import type { Binding, PageNode, PageSchema } from '@lowcode/schema'
import { cloneSchema } from '@lowcode/schema'
import { MaterialRegistryResolver, RuntimeContext } from '@lowcode/runtime'
import { actionRegistry, expressionEngine, materialRegistry, pluginManager } from '../platform'
import { EditorEngine } from '../engine/editor-engine'
import type { DragState } from '../engine/types'

export type { DragState } from '../engine/types'

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
}

const nodeFactory = new NodeFactory(materialRegistry)
const dragDropManager = new DragDropManager()
const resolver = new MaterialRegistryResolver(materialRegistry)

function createFetchHttpClient(): HttpClient {
  return {
    request: async (config) => {
      const url = new URL(config.url, window.location.origin)
      if (config.params) {
        for (const [key, value] of Object.entries(config.params)) {
          if (value !== undefined) url.searchParams.set(key, String(value))
        }
      }
      const response = await fetch(url.toString(), {
        method: config.method ?? 'GET',
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
      })
      if (!response.ok) throw new Error(`请求失败: ${response.status}`)
      return response.json()
    },
  }
}

export interface EditorState {
  schema: PageSchema | null
  engine: EditorEngine | null
  selectedNodeIds: string[]
  hoverNodeId: string | null
  dragState: DragState | null
  dropTarget: DropTarget | null
  zoom: number
  clipboard: PageNode[] | null
  preview: boolean
  panelVisible: { left: boolean; right: boolean; outline: boolean }
  contextMenu: ContextMenuState | null
  dirty: boolean
  saveCallback: ((schema: PageSchema) => void | Promise<void>) | null
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    schema: null,
    engine: null,
    selectedNodeIds: [],
    hoverNodeId: null,
    dragState: null,
    dropTarget: null,
    zoom: 1,
    clipboard: null,
    preview: false,
    panelVisible: { left: true, right: true, outline: true },
    contextMenu: null,
    dirty: false,
    saveCallback: null,
  }),

  getters: {
    selectedNode(state): PageNode | undefined {
      const id = state.selectedNodeIds[0]
      return id ? state.schema?.nodes.find((node) => node.id === id) : undefined
    },
    isSelected(): (nodeId: string) => boolean {
      return (nodeId) => this.selectedNodeIds.includes(nodeId)
    },
    canUndo(): boolean {
      return this.engine?.canUndo ?? false
    },
    canRedo(): boolean {
      return this.engine?.canRedo ?? false
    },
    runtimeContext(): RuntimeContext | null {
      return this.engine?.runtime ?? null
    },
  },

  actions: {
    loadSchema(schema: PageSchema) {
      this.schema = cloneSchema(schema)
      this.selectedNodeIds = []
      this.hoverNodeId = null
      this.clipboard = null
      this.dropTarget = null
      this.dirty = false
      this.preview = false
      this.engine = markRaw(
        new EditorEngine({
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
        }),
      )
      void this.engine.init()
    },

    /** 所有 schema 修改都通过这里进入历史 */
    commit(recipe: (draft: PageSchema) => void, op?: string, mergeKey?: string): void {
      if (!this.schema || !this.engine) return
      this.schema = this.engine.record(recipe, op, mergeKey)
      this.dirty = true
    },

    selectNode(nodeId: string, additive = false) {
      if (additive) {
        this.selectedNodeIds = this.selectedNodeIds.includes(nodeId)
          ? this.selectedNodeIds.filter((id) => id !== nodeId)
          : [...this.selectedNodeIds, nodeId]
      } else {
        this.selectedNodeIds = [nodeId]
      }
      this.contextMenu = null
    },

    selectNodes(nodeIds: string[]) {
      this.selectedNodeIds = nodeIds
      this.contextMenu = null
    },

    hoverNode(nodeId: string | null) {
      this.hoverNodeId = nodeId
    },

    setDragState(state: DragState | null) {
      this.dragState = state
    },

    setDropTarget(target: DropTarget | null) {
      this.dropTarget = target
    },

    /** 场景 1：物料拖入画布 */
    insertMaterial(type: string, target: DropTarget) {
      if (!this.engine) return
      const node = this.engine.insertMaterial(type, target)
      this.schema = this.engine.current
      this.selectedNodeIds = [node.id]
    },

    /** 场景 2：画布内移动节点 */
    moveNode(nodeId: string, target: DropTarget) {
      if (!this.engine) return
      this.engine.moveNode(nodeId, target)
      this.schema = this.engine.current
      this.selectedNodeIds = [nodeId]
    },

    /** 场景 3：修改节点属性 */
    updateProps(nodeId: string, patch: Record<string, unknown>) {
      if (!this.engine) return
      this.engine.updateProps(nodeId, patch)
      this.schema = this.engine.current
    },

    updateNode(nodeId: string, updater: (node: PageNode) => PageNode) {
      if (!this.engine) return
      this.engine.updateNode(nodeId, updater)
      this.schema = this.engine.current
    },

    updateBinding(nodeId: string, key: 'visible' | 'loop', binding: Binding<unknown> | undefined) {
      this.engine?.updateBinding(nodeId, key, binding)
      if (this.engine) this.schema = this.engine.current
    },

    updateStyle(nodeId: string, style: Record<string, Binding<string | number>>) {
      this.engine?.updateStyle(nodeId, style)
      if (this.engine) this.schema = this.engine.current
    },

    updateEvents(nodeId: string, events: PageNode['events']) {
      this.engine?.updateEvents(nodeId, events)
      if (this.engine) this.schema = this.engine.current
    },

    removeNodes(ids: string[]) {
      if (!this.engine) return
      this.engine.removeNodes(ids)
      this.schema = this.engine.current
      this.selectedNodeIds = this.selectedNodeIds.filter((id) => !ids.includes(id))
    },

    removeSelected() {
      if (this.selectedNodeIds.length > 0) this.removeNodes([...this.selectedNodeIds])
    },

    /** 组合：把选中节点包进一个容器 */
    groupSelection() {
      if (!this.schema || !this.engine || this.selectedNodeIds.length < 2) return
      const container: PageNode = {
        id: createNodeId('group'),
        type: 'container',
        props: { direction: 'column', gap: 8, padding: 12, backgroundColor: '' },
        children: [],
      }
      const ids = [...this.selectedNodeIds]
      this.engine.group(ids, container)
      this.schema = this.engine.current
      this.selectedNodeIds = [container.id]
    },

    /** 取消组合：展开选中的容器 */
    ungroupSelection() {
      const id = this.selectedNodeIds[0]
      if (!id || !this.engine) return
      this.engine.ungroup(id)
      this.schema = this.engine.current
      this.selectedNodeIds = []
    },

    copySelected() {
      const nodes = this.selectedNodeIds
        .map((id) => this.schema?.nodes.find((node) => node.id === id))
        .filter((node): node is PageNode => Boolean(node))
      if (nodes.length > 0) {
        this.clipboard = nodes.map((node) => JSON.parse(JSON.stringify(node)) as PageNode)
      }
    },

    paste() {
      if (!this.clipboard || this.clipboard.length === 0 || !this.schema || !this.engine) return
      const source = this.clipboard
      const inserted = this.engine.paste(source)
      this.schema = this.engine.current
      this.selectedNodeIds = inserted.map((node) => node.id)
    },

    undo() {
      const next = this.engine?.undo()
      if (next) {
        this.schema = next
        this.dirty = true
      }
    },

    redo() {
      const next = this.engine?.redo()
      if (next) {
        this.schema = next
        this.dirty = true
      }
    },

    setZoom(zoom: number) {
      this.zoom = Math.min(2, Math.max(0.5, zoom))
    },

    openContextMenu(x: number, y: number, nodeId: string) {
      this.contextMenu = { x, y, nodeId }
    },

    closeContextMenu() {
      this.contextMenu = null
    },

    togglePreview() {
      this.preview = !this.preview
    },

    async save(): Promise<void> {
      if (!this.schema) return
      await pluginManager.runHook('beforePageSave', { schema: this.schema })
      if (this.saveCallback) {
        await this.saveCallback(cloneSchema(this.schema))
      }
      await pluginManager.runHook('afterPageSave', { schema: this.schema })
      this.dirty = false
    },

    computeDropTarget(
      over: {
        node: PageNode
        rect: { left: number; top: number; width: number; height: number }
        depth?: number
      } | null,
      pointer: { x: number; y: number },
      rootRect?: { left: number; top: number; width: number; height: number },
    ): DropTarget | null {
      if (!this.dragState || !this.schema || !this.engine) return null
      return this.engine.computeDropTarget(this.dragState, over, pointer, rootRect)
    },
  },
})
