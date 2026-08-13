import { defineStore } from 'pinia'
import {
  DragDropManager,
  HistoryManager,
  NodeFactory,
  NodeTree,
  createNodeId,
  type DropTarget,
  type HttpClient,
} from '@lowcode/core'
import type { Binding, PageNode, PageSchema } from '@lowcode/schema'
import { cloneSchema } from '@lowcode/schema'
import { MaterialRegistryResolver, RuntimeContext } from '@lowcode/runtime'
import { actionRegistry, expressionEngine, materialRegistry, pluginManager } from '../platform'

export interface DragState {
  source: 'material' | 'canvas'
  materialType?: string
  nodeId?: string
}

export interface ContextMenuState {
  x: number
  y: number
  nodeId: string
}

const nodeFactory = new NodeFactory(materialRegistry)
const dragDropManager = new DragDropManager()
const resolver = new MaterialRegistryResolver(materialRegistry)

/** 历史与运行时上下文放在响应式状态之外，避免 Immer / 类实例被 Proxy 干扰 */
let editorHistory: HistoryManager | null = null
let editorRuntime: RuntimeContext | null = null

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
      return editorHistory?.canUndo ?? false
    },
    canRedo(): boolean {
      return editorHistory?.canRedo ?? false
    },
    runtimeContext(): RuntimeContext | null {
      return editorRuntime
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
      editorHistory = new HistoryManager(this.schema)
      editorRuntime = new RuntimeContext({
        schema: this.schema,
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
      })
      void editorRuntime.init()
    },

    /** 所有 schema 修改都通过这里进入历史 */
    commit(recipe: (draft: PageSchema) => void, op?: string, mergeKey?: string): void {
      if (!this.schema || !editorHistory) return
      this.schema = editorHistory.record(recipe, op, mergeKey)
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
      const node = nodeFactory.create(type)
      this.commit(
        (draft) => {
          new NodeTree(draft.nodes).insert(node, target.parentId, target.slot, target.index)
        },
        'insert',
      )
      this.selectedNodeIds = [node.id]
    },

    /** 场景 2：画布内移动节点 */
    moveNode(nodeId: string, target: DropTarget) {
      this.commit(
        (draft) => {
          new NodeTree(draft.nodes).move(nodeId, {
            parentId: target.parentId,
            slot: target.slot,
            index: target.index,
          })
        },
        'move',
      )
      this.selectedNodeIds = [nodeId]
    },

    /** 场景 3：修改节点属性 */
    updateProps(nodeId: string, patch: Record<string, unknown>) {
      this.commit(
        (draft) => {
          new NodeTree(draft.nodes).updateProps(nodeId, patch)
        },
        'props',
        `props:${nodeId}`,
      )
    },

    updateNode(nodeId: string, updater: (node: PageNode) => PageNode) {
      this.commit(
        (draft) => {
          new NodeTree(draft.nodes).update(nodeId, updater)
        },
        'props',
        `props:${nodeId}`,
      )
    },

    updateBinding(nodeId: string, key: 'visible' | 'loop', binding: Binding<unknown> | undefined) {
      this.updateNode(nodeId, (node) => ({
        ...node,
        bindings: { ...(node.bindings ?? {}), [key]: binding },
      }))
    },

    updateStyle(nodeId: string, style: Record<string, Binding<string | number>>) {
      this.updateNode(nodeId, (node) => ({ ...node, style }))
    },

    updateEvents(nodeId: string, events: PageNode['events']) {
      this.updateNode(nodeId, (node) => ({ ...node, events }))
    },

    removeNodes(ids: string[]) {
      this.commit(
        (draft) => {
          const tree = new NodeTree(draft.nodes)
          for (const id of ids) {
            if (tree.find(id)) tree.remove(id)
          }
        },
        'remove',
      )
      this.selectedNodeIds = this.selectedNodeIds.filter((id) => !ids.includes(id))
    },

    removeSelected() {
      if (this.selectedNodeIds.length > 0) this.removeNodes([...this.selectedNodeIds])
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
      if (!this.clipboard || this.clipboard.length === 0 || !this.schema) return
      const source = this.clipboard
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

      this.commit(
        (draft) => {
          const tree = new NodeTree(draft.nodes)
          for (const item of plan) {
            const newNode: PageNode = {
              ...(JSON.parse(JSON.stringify(item.source)) as PageNode),
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
          }
        },
        'paste',
      )
      this.selectedNodeIds = [...idMap.values()].slice(-source.length)
    },

    undo() {
      const next = editorHistory?.undo()
      if (next) {
        this.schema = next
        this.dirty = true
      }
    },

    redo() {
      const next = editorHistory?.redo()
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
      if (!this.dragState || !this.schema) return null
      const tree = new NodeTree(this.schema.nodes)
      const target = dragDropManager.computeDropTarget(tree, this.dragState, over, pointer, rootRect)
      const validation = dragDropManager.validateDrop(tree, this.dragState, target)
      return validation.ok ? target : null
    },
  },
})
