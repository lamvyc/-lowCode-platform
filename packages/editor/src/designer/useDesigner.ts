import {
  computed,
  reactive,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import {
  DragDropManager,
  NodeFactory,
  NodeTree,
  createUniqueName,
  type DropTarget,
} from '@lowcode/core'
import { MaterialRegistryResolver, type RuntimeContext } from '@lowcode/runtime'
import {
  deserializePage,
  getFormSettings,
  serializePage,
  type AnyPageSchema,
  type FormSettings,
  type PageNode,
  type PageSchema,
  type PageSettings,
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
  /** 表单级设置（已补全默认值） */
  formSettings: ComputedRef<FormSettings>
  selectNode: (id: string | null) => void
  hoverNode: (id: string | null) => void
  setDevice: (d: DeviceType) => void
  setZoom: (z: number) => void
  /** 打开 / 关闭预览（预览以弹窗展示，不再替换整页） */
  setPreview: (open: boolean) => void
  togglePreview: () => void
  undo: () => void
  redo: () => void
  clear: () => void
  insertMaterial: (type: string, target?: DropTarget) => void
  moveNode: (nodeId: string, target: DropTarget) => void
  selectParent: (nodeId: string) => void
  moveNodeUp: (nodeId: string) => void
  moveNodeDown: (nodeId: string) => void
  duplicateNode: (nodeId: string) => void
  canMoveUp: (nodeId: string) => boolean
  canMoveDown: (nodeId: string) => boolean
  getParentId: (nodeId: string) => string | null
  removeNode: (id: string) => void
  copyNode: (id: string) => void
  pasteClipboard: () => void
  updateProps: (id: string, patch: Record<string, unknown>) => void
  updateNode: (id: string, updater: (n: PageNode) => PageNode) => void
  updateNodeEvents: (id: string, events: PageNode['events']) => void
  /** 追加内部结构子节点（栅格列 / 表格行 / 标签页），返回新节点 id 列表 */
  appendChild: (parentId: string, type: string, count?: number) => string[]
  /** 批量删除节点（级联删除后代），合并为一条历史 */
  removeNodes: (ids: string[]) => void
  /** 追加一个栅格列（span 缺省按参考实现计算剩余宽度），返回新列 id */
  addGridColumn: (gridId: string, span?: number) => string | null
  /** 复制栅格列：参考实现行为——末尾追加同宽度的空列，不改选中 */
  cloneGridColumn: (columnId: string) => string | null
  /**
   * 删除栅格列。
   * `selectAdjacent` 为真时选中相邻列 / 父栅格（画布操作条的口径）；
   * 结构编辑器从栅格面板删列时传 false，保持栅格选中，面板不跳走。
   */
  removeGridColumn: (columnId: string, selectAdjacent?: boolean) => void
  /** 复制栅格容器：保留布局宽度、清空列内容（参考实现 cloneContainer 行为） */
  cloneGrid: (gridId: string) => void
  updateSettings: (patch: Partial<PageSettings>) => void
  updateFormSettings: (patch: Partial<FormSettings>) => void
  resetFormSettings: () => void
  setDragState: (ds: DragState | null) => void
  setDropTarget: (dt: DropTarget | null) => void
  importSchema: (json: string) => { ok: boolean; error?: string }
  /** 直接载入 Schema（页面模板 / 版本回滚），重置历史并清空选中 */
  loadSchema: (next: AnyPageSchema) => void
  exportSchema: () => string
}

export const DESIGNER_KEY: InjectionKey<DesignerContext> = Symbol('lc.designer')

/**
 * 设计器状态：创建 EditorEngine + 视图状态，封装所有 schema 修改并同步响应式快照。
 */
export function useDesigner(options: UseDesignerOptions): DesignerContext {
  initPlatform()

  const nodeFactory = new NodeFactory(materialRegistry)
  const engine = new EditorEngine({
    schema: options.schema,
    nodeFactory,
    dragDropManager: new DragDropManager(),
    runtime: {
      resolver: new MaterialRegistryResolver(materialRegistry),
      actionRegistry,
      expression: expressionEngine,
      /**
       * ⚠️ 必须注入 `navigate`，否则 `navigate` 动作是**静默空操作**：
       * 动作实现里是 `ctx.navigate?.(route)`（可选链），不注入就什么都不发生，
       * 也不报错——表现为"配了跳转但点了没反应"。
       *
       * 用 `location.hash` 与 **codegen 生成的代码保持一致**：
       * `scripts/codegen` 产出的 `runAction` 里 navigate 就是 `location.hash = route`。
       * 预览态应当模拟运行态的行为，两边不能各走一套。
       */
      navigate: (route: string) => {
        if (typeof window !== 'undefined') window.location.hash = route
      },
      /**
       * ⚠️ 必须注入 `request`，否则「请求数据」动作在预览里**一定失败**：
       * 内置实现里有 `if (!ctx.request) return { ok:false, error:'运行时未提供 request 能力' }`。
       *
       * 安全性前提：**设计态已经不再执行节点事件**（见 renderer.ts 的 designMode 守卫），
       * 所以画布上点按钮不会发请求；只有预览态才会真的发。
       *
       * 非 2xx 主动抛错，让动作链返回 `{ok:false}` 并被错误收集器记下来——
       * 静默拿到一个 HTML 错误页当数据反而是更糟的行为。
       */
      request: async (config) => {
        const method = (config.method ?? 'GET').toUpperCase()
        const url = new URL(String(config.url ?? ''), window.location.origin)
        if (config.params) {
          for (const [key, value] of Object.entries(config.params)) {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
          }
        }
        const res = await fetch(url.toString(), {
          method,
          headers: config.headers,
          body:
            config.body !== undefined && method !== 'GET' && method !== 'HEAD'
              ? JSON.stringify(config.body)
              : undefined,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!text) return null
        try {
          return JSON.parse(text) as unknown
        } catch {
          return text
        }
      },
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

  /** 表单设置：始终返回补全默认值后的对象，避免面板到处判空 */
  const formSettings = computed<FormSettings>(() => getFormSettings(schema.value.settings))

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
    state.zoom = Math.max(0.3, Math.min(3, zoom))
  }
  function setPreview(open: boolean): void {
    state.preview = open
  }
  function togglePreview(): void {
    setPreview(!state.preview)
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
  function tree(): NodeTree {
    return new NodeTree(engine.current.nodes)
  }
  function selectParent(nodeId: string): void {
    const parent = tree().getParent(nodeId)
    if (parent) selectNode(parent.node.id)
  }
  /** 节点当前是否会渲染到画布上（meta.hidden 或 visible 绑定为假时不渲染） */
  function isRenderable(nodeId: string): boolean {
    const node = engine.current.nodes.find((n) => n.id === nodeId)
    if (!node) return false
    if (node.meta?.hidden) return false
    return runtime.value.resolveVisible(node)
  }
  function moveNodeUp(nodeId: string): void {
    engine.moveNodeUp(nodeId, isRenderable)
    sync()
  }
  function moveNodeDown(nodeId: string): void {
    engine.moveNodeDown(nodeId, isRenderable)
    sync()
  }
  function duplicateNode(nodeId: string): void {
    const inserted = engine.duplicate(nodeId)
    sync()
    if (inserted.length > 0) selectNode(inserted[0].id)
  }
  function canMoveUp(nodeId: string): boolean {
    return engine.canMoveUp(nodeId, isRenderable)
  }
  function canMoveDown(nodeId: string): boolean {
    return engine.canMoveDown(nodeId, isRenderable)
  }
  function getParentId(nodeId: string): string | null {
    return tree().getParent(nodeId)?.node.id ?? null
  }
  function removeNode(id: string): void {
    engine.removeNodes([id])
    sync()
    if (state.selectedNodeId && !engine.current.nodes.some((n) => n.id === state.selectedNodeId)) {
      selectNode(null)
    }
  }

  const clipboard = shallowRef<PageNode[]>([])

  /** 收集节点及其后代（平铺） */
  function collectSubtree(id: string): PageNode[] {
    const node = engine.current.nodes.find((n) => n.id === id)
    if (!node) return []
    const result: PageNode[] = [node]
    const stack = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()]
    while (stack.length > 0) {
      const childId = stack.pop()!
      const child = engine.current.nodes.find((n) => n.id === childId)
      if (child) {
        result.push(child)
        stack.push(...(child.children ?? []), ...Object.values(child.slots ?? {}).flat())
      }
    }
    return result
  }

  function copyNode(id: string): void {
    clipboard.value = collectSubtree(id)
  }

  function pasteClipboard(): void {
    if (clipboard.value.length === 0) return
    const inserted = engine.paste(clipboard.value)
    sync()
    if (inserted.length > 0) selectNode(inserted[inserted.length - 1].id)
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
  function updateNodeEvents(id: string, events: PageNode['events']): void {
    engine.updateEvents(id, events)
    sync()
  }
  function appendChild(parentId: string, type: string, count = 1): string[] {
    const created = engine.appendChildren(parentId, type, count)
    sync()
    return created.map((node) => node.id)
  }
  function removeNodes(ids: string[]): void {
    if (ids.length === 0) return
    engine.removeNodes(ids)
    sync()
    if (state.selectedNodeId && !engine.current.nodes.some((n) => n.id === state.selectedNodeId)) {
      selectNode(null)
    }
  }

  /** 取栅格下的列节点（保持 children 顺序） */
  function gridColumnsOf(gridId: string): PageNode[] {
    const byId = new Map(engine.current.nodes.map((node) => [node.id, node]))
    const grid = byId.get(gridId)
    return (grid?.children ?? [])
      .map((id) => byId.get(id))
      .filter((node): node is PageNode => node?.type === 'grid-col')
  }

  /** 读取列宽；缺失或非法值回落到默认 12 */
  function spanOf(column: PageNode): number {
    const span = Number(column.props.span)
    return Number.isFinite(span) ? span : 12
  }

  /**
   * 追加栅格列。span 缺省时按参考实现 `addNewColOfGrid` 的口径计算：
   * 当前列宽合计 ≥24 时新列用默认 12；否则补足 24（最多 12）。
   */
  function addGridColumn(gridId: string, span?: number): string | null {
    const grid = engine.current.nodes.find((node) => node.id === gridId)
    if (!grid || grid.type !== 'grid') return null
    const columns = gridColumnsOf(gridId)
    const spanSum = columns.reduce((sum, column) => sum + spanOf(column), 0)
    const remaining = 24 - spanSum
    const resolvedSpan =
      span ?? (columns.length === 0 || remaining <= 0 ? 12 : Math.min(12, remaining))
    const [created] = engine.appendChildrenWithProps(gridId, 'grid-col', [
      { span: resolvedSpan },
    ])
    sync()
    return created?.id ?? null
  }

  /**
   * 复制栅格列：与参考实现 `cloneGridCol` 一致——在栅格末尾追加一个**空列**，
   * 只复制宽度（span），不复制内容；不改变当前选中。
   */
  function cloneGridColumn(columnId: string): string | null {
    const column = engine.current.nodes.find((node) => node.id === columnId)
    if (!column || column.type !== 'grid-col') return null
    const parent = new NodeTree(engine.current.nodes).getParent(columnId)
    if (!parent || parent.node.type !== 'grid') return null
    const span = spanOf(column)
    const [created] = engine.appendChildrenWithProps(parent.node.id, 'grid-col', [{ span }])
    sync()
    return created?.id ?? null
  }

  /**
   * 删除栅格列并选中相邻列；删到只剩最后一列时选中父栅格。
   * 对齐参考实现 `grid-col-widget.vue: removeWidget()` 的选中策略。
   */
  function removeGridColumn(columnId: string, selectAdjacent = true): void {
    const position = new NodeTree(engine.current.nodes).getPosition(columnId)
    if (position.parentId === null) return
    const { siblingIds, index, parentId } = position
    const next =
      siblingIds.length <= 1
        ? parentId
        : siblingIds[index === siblingIds.length - 1 ? index - 1 : index + 1] ?? parentId
    const wasSelected = state.selectedNodeId === columnId
    engine.removeNodes([columnId])
    sync()
    if (selectAdjacent) selectNode(next)
    else if (wasSelected) selectNode(parentId)
  }

  /**
   * 复制栅格容器：参考实现 `cloneContainer('grid')` 复制的是**结构**——
   * 保留列数与各列宽度，但清空列内容（不深拷贝子树），并在源节点后插入、选中新栅格。
   * 本实现额外保留 gutter / colHeight 等布局属性（参考实现会回落到默认值）。
   */
  function cloneGrid(gridId: string): void {
    const source = engine.current.nodes.find((node) => node.id === gridId)
    if (!source || source.type !== 'grid') return
    const position = new NodeTree(engine.current.nodes).getPosition(gridId)
    const spans = gridColumnsOf(gridId).map(spanOf)

    const taken = new Set(engine.current.nodes.map((node) => node.name ?? node.id))
    const grid = nodeFactory.create('grid', { props: { ...source.props } })
    if (!grid.name || taken.has(grid.name)) grid.name = createUniqueName('grid', taken)

    engine.record((draft) => {
      const tree = new NodeTree(draft.nodes)
      tree.insert(grid, position.parentId, position.slot, position.index + 1)
      const names = new Set(draft.nodes.map((node) => node.name ?? node.id))
      for (const span of spans) {
        const column = nodeFactory.create('grid-col', { props: { span } })
        if (!column.name || names.has(column.name)) {
          column.name = createUniqueName('grid-col', names)
        }
        names.add(column.name)
        tree.insert(column, grid.id, 'default', undefined)
      }
    }, 'clone')
    sync()
    selectNode(grid.id)
  }
  function updateSettings(patch: Partial<PageSettings>): void {
    engine.updateSettings(patch)
    sync()
  }
  function updateFormSettings(patch: Partial<FormSettings>): void {
    engine.updateFormSettings(patch)
    sync()
  }
  function resetFormSettings(): void {
    engine.resetFormSettings()
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
  function loadSchema(next: AnyPageSchema): void {
    engine.load(next)
    sync()
    selectNode(null)
    hoverNode(null)
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
    formSettings,
    selectNode,
    hoverNode,
    setDevice,
    setZoom,
    setPreview,
    togglePreview,
    undo,
    redo,
    clear,
    insertMaterial,
    moveNode,
    selectParent,
    moveNodeUp,
    moveNodeDown,
    duplicateNode,
    canMoveUp,
    canMoveDown,
    getParentId,
    removeNode,
    copyNode,
    pasteClipboard,
    updateProps,
    updateNode,
    updateNodeEvents,
    appendChild,
    removeNodes,
    addGridColumn,
    cloneGridColumn,
    removeGridColumn,
    cloneGrid,
    updateSettings,
    updateFormSettings,
    resetFormSettings,
    setDragState,
    setDropTarget,
    importSchema,
    loadSchema,
    exportSchema,
  }
}
