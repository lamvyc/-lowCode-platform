import {
  computed,
  reactive,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import { DragDropManager, NodeFactory, type DropTarget } from '@lowcode/core'
import { MaterialRegistryResolver, type RuntimeContext } from '@lowcode/runtime'
import {
  deserializePage,
  serializePage,
  type PageNode,
  type PageSchema,
} from '@lowcode/schema'
import { EditorEngine } from '../engine/editor-engine'
import type { DragState } from '../engine/types'
import {
  actionRegistry,
  expressionEngine,
  initPlatform,
  materialRegistry,
} from '../platform'
import type { DesignerViewState, DeviceType } from './types'

export interface UseDesignerOptions {
  schema: PageSchema
}

export interface DesignerContext {
  engine: EditorEngine
  schema: Ref<PageSchema>
  runtime: Ref<RuntimeContext>
  state: DesignerViewState
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  selectedNode: ComputedRef<PageNode | undefined>
  selectNode: (id: string | null) => void
  hoverNode: (id: string | null) => void
  setDevice: (d: DeviceType) => void
  setZoom: (z: number) => void
  togglePreview: () => void
  undo: () => void
  redo: () => void
  clear: () => void
  insertMaterial: (type: string, target?: DropTarget) => void
  moveNode: (nodeId: string, target: DropTarget) => void
  removeNode: (id: string) => void
  updateProps: (id: string, patch: Record<string, unknown>) => void
  updateNode: (id: string, updater: (n: PageNode) => PageNode) => void
  setDragState: (ds: DragState | null) => void
  setDropTarget: (dt: DropTarget | null) => void
  importSchema: (json: string) => { ok: boolean; error?: string }
  exportSchema: () => string
}

export const DESIGNER_KEY: InjectionKey<DesignerContext> = Symbol('lc.designer')

/**
 * 设计器状态：创建 EditorEngine + 视图状态，封装所有 schema 修改并同步响应式快照。
 */
export function useDesigner(options: UseDesignerOptions): DesignerContext {
  initPlatform()

  const engine = new EditorEngine({
    schema: options.schema,
    nodeFactory: new NodeFactory(materialRegistry),
    dragDropManager: new DragDropManager(),
    runtime: {
      resolver: new MaterialRegistryResolver(materialRegistry),
      actionRegistry,
      expression: expressionEngine,
    },
  })

  const schema = shallowRef<PageSchema>(engine.current)
  const runtime = shallowRef<RuntimeContext>(engine.runtime)
  const state = reactive<DesignerViewState>({
    selectedNodeId: null,
    hoverNodeId: null,
    device: 'pc',
    zoom: 1,
    preview: false,
    dragState: null,
    dropTarget: null,
  })

  function sync(): void {
    schema.value = engine.current
    runtime.value = engine.runtime
  }

  const canUndo = computed(() => {
    void schema.value
    return engine.canUndo
  })
  const canRedo = computed(() => {
    void schema.value
    return engine.canRedo
  })
  const selectedNode = computed<PageNode | undefined>(() => {
    const current = schema.value
    return state.selectedNodeId
      ? current.nodes.find((n) => n.id === state.selectedNodeId)
      : undefined
  })

  function selectNode(id: string | null): void {
    state.selectedNodeId = id
  }
  function hoverNode(id: string | null): void {
    state.hoverNodeId = id
  }
  function setDevice(device: DeviceType): void {
    state.device = device
  }
  function setZoom(zoom: number): void {
    state.zoom = zoom
  }
  function togglePreview(): void {
    state.preview = !state.preview
  }
  function undo(): void {
    engine.undo()
    sync()
    if (state.selectedNodeId && !engine.current.nodes.some((n) => n.id === state.selectedNodeId)) {
      selectNode(null)
    }
  }
  function redo(): void {
    engine.redo()
    sync()
    if (state.selectedNodeId && !engine.current.nodes.some((n) => n.id === state.selectedNodeId)) {
      selectNode(null)
    }
  }
  function clear(): void {
    engine.clear()
    sync()
    selectNode(null)
  }
  function insertMaterial(type: string, target?: DropTarget): void {
    const node = engine.insertMaterial(
      type,
      target ?? { parentId: null, position: 'root', index: engine.current.nodes.length },
    )
    sync()
    selectNode(node.id)
  }
  function moveNode(nodeId: string, target: DropTarget): void {
    engine.moveNode(nodeId, target)
    sync()
    selectNode(nodeId)
  }
  function removeNode(id: string): void {
    engine.removeNodes([id])
    sync()
    if (state.selectedNodeId === id) selectNode(null)
  }
  function setDragState(ds: DragState | null): void {
    state.dragState = ds
  }
  function setDropTarget(dt: DropTarget | null): void {
    state.dropTarget = dt
  }
  function updateProps(id: string, patch: Record<string, unknown>): void {
    engine.updateProps(id, patch)
    sync()
  }
  function updateNode(id: string, updater: (n: PageNode) => PageNode): void {
    engine.updateNode(id, updater)
    sync()
  }
  function importSchema(json: string): { ok: boolean; error?: string } {
    try {
      const parsed = deserializePage(json)
      engine.load(parsed)
      sync()
      selectNode(null)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  function exportSchema(): string {
    return serializePage(engine.current, true)
  }

  return {
    engine,
    schema,
    runtime,
    state,
    canUndo,
    canRedo,
    selectedNode,
    selectNode,
    hoverNode,
    setDevice,
    setZoom,
    togglePreview,
    undo,
    redo,
    clear,
    insertMaterial,
    moveNode,
    removeNode,
    updateProps,
    updateNode,
    setDragState,
    setDropTarget,
    importSchema,
    exportSchema,
  }
}
