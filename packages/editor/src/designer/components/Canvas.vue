<script setup lang="ts">
import {
  computed,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type VNode,
} from 'vue'
import type { DropTarget } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'
import { RuntimeRenderer } from '@lowcode/runtime'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { DEVICE_BORDER, deviceDimension } from '../device'
import { materialRegistry } from '../../platform'
import {
  computeListDrop,
  visibleIndexToSchemaIndex,
  type DropAxis,
  type DropRect,
} from '../../engine/drop-target'
import {
  beginDragGhost,
  endDragGhost,
  moveDragGhost,
  transparentDragImage,
} from '../drag-ghost'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const {
  schema,
  runtime,
  state,
  selectNode,
  hoverNode,
  insertMaterial,
  moveNode,
  selectParent,
  moveNodeUp,
  moveNodeDown,
  duplicateNode,
  canMoveUp,
  canMoveDown,
  removeNode,
  setDragState,
  setDropTarget,
} = ctx

/* ------------------------------------------------------------------ *
 * 节点索引：一次遍历建立「子 → 父」「id → 类型」映射，避免逐节点 O(n) 查父
 * ------------------------------------------------------------------ */
const nodeIndexOf = computed(() => {
  const parentOf = new Map<string, string>()
  const typeById = new Map<string, string>()
  for (const node of schema.value.nodes) {
    typeById.set(node.id, node.type)
    for (const childId of node.children ?? []) parentOf.set(childId, node.id)
    for (const ids of Object.values(node.slots ?? {})) {
      for (const childId of ids) parentOf.set(childId, node.id)
    }
  }
  return { parentOf, typeById }
})

/**
 * 父级为这些布局容器时，节点不能再套一层 div：
 * el-row 要求直接子级是 el-col、table 要求 tbody>tr>td，插入包裹层会破坏布局。
 * 这类节点改用「嵌入式包裹」：直接把选中态 class 与事件合并到组件根 vnode 上。
 */
const LAYOUT_TRANSPARENT_PARENTS = new Set(['grid', 'layout-table', 'layout-table-row'])

const wrapNode = computed(() => {
  const { parentOf, typeById } = nodeIndexOf.value

  return (node: PageNode, inner: VNode): VNode => {
    const isSelected = state.selectedNodeId === node.id
    const isHovered = state.hoverNodeId === node.id
    const isDragging = state.dragState?.source === 'canvas' && state.dragState.nodeId === node.id
    const typeLabel = materialRegistry.get(node.type)?.name ?? node.type
    const drop = state.dropTarget
    const isDropInside = drop?.position === 'inside' && drop.targetId === node.id
    // 操作条仅在选中时渲染，未选中无需计算（也避免逐节点求值 visible 带来的开销）
    const hasParent = isSelected ? parentOf.has(node.id) : false
    const upEnabled = isSelected ? canMoveUp(node.id) : false
    const downEnabled = isSelected ? canMoveDown(node.id) : false

    const parentId = parentOf.get(node.id)
    const parentType = parentId ? typeById.get(parentId) : undefined
    const embedded = parentType ? LAYOUT_TRANSPARENT_PARENTS.has(parentType) : false

    const stateClasses = [
      isSelected ? 'lc-node--selected' : '',
      isHovered ? 'lc-node--hovered' : '',
      isDragging ? 'lc-node--dragging' : '',
      isDropInside ? 'lc-node--drop-inside' : '',
    ]

    if (embedded) {
      const props = (inner.props ?? {}) as Record<string, unknown>
      inner.props = {
        ...props,
        class: [props.class, 'lc-node--embedded', ...stateClasses],
        'data-node-id': node.id,
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          selectNode(node.id)
        },
        onMouseenter: () => hoverNode(node.id),
        onMouseleave: () => hoverNode(null),
      }
      return inner
    }

    return h(
      'div',
      {
        class: ['lc-node', ...stateClasses],
        'data-node-id': node.id,
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          selectNode(node.id)
        },
        onMouseenter: () => hoverNode(node.id),
        onMouseleave: () => hoverNode(null),
      },
      [
        inner,
        // 与 variant-form 一致：拖拽手柄只在选中时出现，位于左上角
        ...(isSelected
          ? [
              h(
                'div',
                {
                  class: 'lc-node__badges',
                  draggable: 'true',
                  title: '按住拖动排序 / 移动',
                  onDragstart: (event: DragEvent) => onNodeDragStart(event, node),
                  onDragend: () => finishDrag(),
                },
                [
                  h('i', { class: 'lc-node__rank' }, '⠿'),
                  h('i', { class: 'lc-node__type' }, typeLabel),
                  ...(node.meta?.hidden ? [h('i', { class: 'lc-node__hidden' }, '已隐藏')] : []),
                ],
              ),
              h(
                'div',
                {
                  class: 'lc-node__actions',
                  onClick: (event: MouseEvent) => event.stopPropagation(),
                },
                [
                  h(
                    'button',
                    {
                      class: ['lc-node__action', { 'lc-node__action--disabled': !hasParent }],
                      title: '选中父级',
                      disabled: !hasParent,
                      onClick: () => selectParent(node.id),
                    },
                    '←',
                  ),
                  h(
                    'button',
                    {
                      class: ['lc-node__action', { 'lc-node__action--disabled': !upEnabled }],
                      title: '上移',
                      disabled: !upEnabled,
                      onClick: () => moveNodeUp(node.id),
                    },
                    '↑',
                  ),
                  h(
                    'button',
                    {
                      class: ['lc-node__action', { 'lc-node__action--disabled': !downEnabled }],
                      title: '下移',
                      disabled: !downEnabled,
                      onClick: () => moveNodeDown(node.id),
                    },
                    '↓',
                  ),
                  h(
                    'button',
                    {
                      class: 'lc-node__action',
                      title: '复制',
                      onClick: () => duplicateNode(node.id),
                    },
                    '复制',
                  ),
                  h(
                    'button',
                    {
                      class: 'lc-node__action lc-node__action--danger',
                      title: '删除',
                      onClick: () => removeNode(node.id),
                    },
                    '删除',
                  ),
                ],
              ),
            ]
          : []),
      ],
    )
  }
})

const isEmpty = computed(() => schema.value.nodes.length === 0)

const dimension = computed(() => deviceDimension(state.device))

/** 设备总尺寸（含边框） */
const totalSize = computed(() => {
  const d = dimension.value
  if (!d) return null
  return { width: d.width + DEVICE_BORDER * 2, height: d.height + DEVICE_BORDER * 2 }
})

/** 缩放：工作区小于设备时等比例缩小 */
const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | null = null

function updateScale(): void {
  const el = wrapRef.value
  const total = totalSize.value
  if (!el || !total) {
    scale.value = 1
    return
  }
  const availW = el.clientWidth - 48
  const availH = el.clientHeight - 48
  scale.value = Math.max(0.2, Math.min(1, availW / total.width, availH / total.height))
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(updateScale)
    if (wrapRef.value) observer.observe(wrapRef.value)
  }
  updateScale()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  stopAutoScroll()
  endDragGhost()
})
watch(() => state.device, updateScale)

/** 缩放容器布局尺寸（= 设备总尺寸 × scale），并叠加用户缩放 */
const viewportStyle = computed(() => {
  const total = totalSize.value
  if (!total) return {}
  return {
    width: `${total.width * scale.value}px`,
    height: `${total.height * scale.value}px`,
    zoom: state.zoom,
  }
})

/** 设备画布样式（固定尺寸 + 等比缩放） */
const deviceStyle = computed(() => {
  const total = totalSize.value
  if (!total) return {}
  return {
    width: `${total.width}px`,
    height: `${total.height}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: 'top left',
  }
})

/* ------------------------------------------------------------------ *
 * 拖拽：落点计算（与 Sortable 一致 —— 最内层可接收容器 + 主轴中线判定）
 * ------------------------------------------------------------------ */

/** 当前插入指示条（视口坐标，通过 Teleport 渲染到 body，避开画布缩放坐标系） */
const dropIndicator = ref<DropRect | null>(null)

const indicatorStyle = computed(() => {
  const rect = dropIndicator.value
  if (!rect) return undefined
  return {
    left: `${Math.round(rect.left)}px`,
    top: `${Math.round(rect.top)}px`,
    width: `${Math.round(rect.width)}px`,
    height: `${Math.round(rect.height)}px`,
  }
})

/** id 是否为 ancestorId 自身或其后代 */
function isSelfOrDescendant(nodeId: string, ancestorId: string): boolean {
  let current: string | null = nodeId
  while (current !== null) {
    if (current === ancestorId) return true
    current = nodeIndexOf.value.parentOf.get(current) ?? null
  }
  return false
}

/** DOM：某元素的最近节点祖先 id（跨 Teleport，向上走到 body） */
function closestNodeId(el: Element | null): string | null {
  let current: Element | null = el
  while (current) {
    const id = (current as HTMLElement).dataset?.nodeId
    if (id) return id
    current = current.parentElement
  }
  return null
}

/** DOM：列出所有已渲染节点元素，并按「父节点 id → 子元素」归组（DOM 顺序即 children 顺序） */
function collectLists(): Map<string | null, HTMLElement[]> {
  const lists = new Map<string | null, HTMLElement[]>()
  for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
    const parentId = closestNodeId(el.parentElement)
    const bucket = lists.get(parentId)
    if (bucket) bucket.push(el)
    else lists.set(parentId, [el])
  }
  return lists
}

/** 指针下最内层的「可接收容器」；null 表示根列表；undefined 表示指针不在画布上 */
function findContainerAt(
  clientX: number,
  clientY: number,
): string | null | undefined {
  const canvasEl = canvasRef.value
  const stack = typeof document.elementsFromPoint === 'function'
    ? document.elementsFromPoint(clientX, clientY)
    : []
  const top = stack[0] as HTMLElement | undefined

  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue
    let nodeId = closestNodeId(el)
    while (nodeId) {
      const type = nodeIndexOf.value.typeById.get(nodeId)
      const material = type ? materialRegistry.get(type) : undefined
      if (material?.droppable) return nodeId
      nodeId = nodeIndexOf.value.parentOf.get(nodeId) ?? null
    }
  }

  // 不在任何节点上：只有指针位于画布内时才落到根列表
  if (top && canvasEl?.contains(top)) return null
  return undefined
}

/** 容器主轴：flex row 与 grid 视为横向，其余纵向 */
function axisOf(el: HTMLElement | null): DropAxis {
  if (!el) return 'y'
  const style = getComputedStyle(el)
  if (style.display === 'flex' && style.flexDirection.startsWith('row')) return 'x'
  if (style.display === 'grid') return 'x'
  return 'y'
}

function toDropRect(rect: DOMRect): DropRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/**
 * 容器在 schema 里的**完整**子节点顺序（含不渲染的节点）。
 *
 * 根层没有显式 children，渲染器的判定是"未被任何节点的 children/slots 引用"，
 * 这里保持一致，否则根层落点会与渲染顺序对不上。
 */
function schemaChildrenOf(containerId: string | null): string[] {
  if (containerId) {
    return schema.value.nodes.find((node) => node.id === containerId)?.children ?? []
  }
  const referenced = new Set<string>()
  for (const node of schema.value.nodes) {
    for (const childId of node.children ?? []) referenced.add(childId)
    for (const ids of Object.values(node.slots ?? {})) {
      for (const childId of ids) referenced.add(childId)
    }
  }
  return schema.value.nodes.filter((node) => !referenced.has(node.id)).map((node) => node.id)
}

/** 计算落点与插入指示条 */
function computeDrop(event: DragEvent): { target: DropTarget; indicator: DropRect } | null {
  const dragState = state.dragState
  if (!dragState) return null

  let containerId = findContainerAt(event.clientX, event.clientY)
  if (containerId === undefined) return null

  const draggedId = dragState.source === 'canvas' ? dragState.nodeId : undefined
  // 画布内拖动时不能落进自己或自己的后代：收敛到被拖节点的父容器
  if (draggedId && containerId && isSelfOrDescendant(containerId, draggedId)) {
    containerId = nodeIndexOf.value.parentOf.get(draggedId) ?? null
  }

  const lists = collectLists()
  const childEls = (lists.get(containerId) ?? []).filter(
    (el) => el.dataset.nodeId !== draggedId,
  )
  const containerEl = containerId
    ? document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(containerId)}"]`)
    : canvasRef.value?.querySelector<HTMLElement>('.lc-runtime-root') ?? null

  const listRect = containerEl
    ? toDropRect(containerEl.getBoundingClientRect())
    : toDropRect(canvasRef.value?.getBoundingClientRect() ?? new DOMRect())

  const result = computeListDrop({
    containerId,
    childIds: childEls.map((el) => el.dataset.nodeId ?? ''),
    childRects: childEls.map((el) => toDropRect(el.getBoundingClientRect())),
    listRect,
    axis: axisOf(containerEl),
    pointer: { x: event.clientX, y: event.clientY },
  })
  if (!result) return null

  // ⚠️ 可见索引 → schema 索引。
  // `computeListDrop` 的索引是按画布上**渲染出来的**子节点算的（用 DOM 矩形），
  // 而 schema 的 children 里可能还有不渲染的节点（`visible` 绑定为假 / `meta.hidden`）——
  // 它们不在 DOM 里却仍占着顺序槽位。直接用可见索引写回会插错位置。
  // 这与 docs/questionBug.md 的 question3 同根因（那次修了上移/下移，落点这条路径漏了）。
  //
  // ⚠️ 另外：画布内拖动排序时 `NodeTree.move` 会**先 detach 再插入**，而
  // `collectLists` 也已经把被拖节点滤掉了。因此基准列表必须同样**排除被拖节点**，
  // 否则索引会整体偏一位（物料拖入时 draggedId 为 undefined，此过滤是空操作）。
  const visibleIds = childEls.map((el) => el.dataset.nodeId ?? '').filter(Boolean)
  const fullIds = schemaChildrenOf(containerId).filter((id) => id !== draggedId)
  result.target.index = visibleIndexToSchemaIndex(fullIds, visibleIds, result.target.index)
  result.target.beforeId = fullIds[result.target.index]
  return result}

/* ---------------- 自动滚动：拖到画布边缘时滚动容器 ---------------- */

const SCROLL_EDGE = 48
const SCROLL_STEP = 18
let autoScrollFrame = 0
let lastPointer = { x: 0, y: 0 }

function autoScrollTick(): void {
  autoScrollFrame = 0
  if (!state.dragState) return
  const scrollers: HTMLElement[] = []
  if (canvasRef.value) scrollers.push(canvasRef.value)
  if (wrapRef.value) scrollers.push(wrapRef.value)

  for (const el of scrollers) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (lastPointer.x < rect.left + SCROLL_EDGE) el.scrollLeft -= SCROLL_STEP
    else if (lastPointer.x > rect.right - SCROLL_EDGE) el.scrollLeft += SCROLL_STEP
    if (lastPointer.y < rect.top + SCROLL_EDGE) el.scrollTop -= SCROLL_STEP
    else if (lastPointer.y > rect.bottom - SCROLL_EDGE) el.scrollTop += SCROLL_STEP
  }
  autoScrollFrame = requestAnimationFrame(autoScrollTick)
}

function startAutoScroll(): void {
  if (autoScrollFrame === 0) autoScrollFrame = requestAnimationFrame(autoScrollTick)
}

function stopAutoScroll(): void {
  if (autoScrollFrame !== 0) {
    cancelAnimationFrame(autoScrollFrame)
    autoScrollFrame = 0
  }
}

/* ---------------- 拖拽生命周期 ---------------- */

function onNodeDragStart(event: DragEvent, node: PageNode): void {
  const handle = event.currentTarget as HTMLElement
  const nodeEl = handle.closest('[data-node-id]') as HTMLElement | null
  const typeLabel = materialRegistry.get(node.type)?.name ?? node.type
  beginDragGhost({ sourceEl: nodeEl, label: typeLabel, point: { x: event.clientX, y: event.clientY } })
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-lc-node', node.id)
    // 用自有浮层替代浏览器默认影像，避免出现两个拖拽影像
    event.dataTransfer.setDragImage(transparentDragImage(), 0, 0)
  }
  setDragState({ source: 'canvas', nodeId: node.id })
  startAutoScroll()
}

function finishDrag(): void {
  setDragState(null)
  setDropTarget(null)
  dropIndicator.value = null
  stopAutoScroll()
  endDragGhost()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && state.dragState) {
    finishDrag()
  }
}

function onDragOver(event: DragEvent): void {
  if (!state.dragState) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = state.dragState.source === 'material' ? 'copy' : 'move'
  }
  lastPointer = { x: event.clientX, y: event.clientY }
  moveDragGhost(event.clientX, event.clientY)

  const result = computeDrop(event)
  if (!result) {
    setDropTarget(null)
    dropIndicator.value = null
    return
  }
  setDropTarget(result.target)
  dropIndicator.value = result.indicator
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const dragState = state.dragState
  const target = state.dropTarget ?? computeDrop(event)?.target ?? null
  if (dragState && target) {
    if (dragState.source === 'material' && dragState.materialType) {
      insertMaterial(dragState.materialType, target)
    } else if (dragState.source === 'canvas' && dragState.nodeId) {
      moveNode(dragState.nodeId, target)
    }
  }
  finishDrag()
}

function onDragLeave(event: DragEvent): void {
  // 只在真正离开画布时清除指示条（子元素间移动会冒泡 dragleave）
  const related = event.relatedTarget as HTMLElement | null
  if (related && canvasRef.value?.contains(related)) return
  dropIndicator.value = null
  setDropTarget(null)
}
</script>

<template>
  <main
    ref="wrapRef"
    class="lc-canvas-wrap"
    :class="`lc-canvas-wrap--${state.device}`"
    @dragend="finishDrag"
    @dragleave="onDragLeave"
  >
    <!-- PC：白色画布铺满工作区 -->
    <div
      v-if="state.device === 'pc'"
      ref="canvasRef"
      class="lc-canvas lc-canvas--pc"
      :class="{ 'lc-canvas--empty': isEmpty }"
      :style="{ zoom: state.zoom }"
      @drop="onDrop"
      @dragover="onDragOver"
    >
      <!-- ⚠️ 即使画布为空也要渲染渲染器：参考实现**始终**渲染白色表单面
           （`.widget-form`），空态提示是它内部的一个元素。
           此前用 `v-if="!isEmpty"` 把渲染器整个换掉，于是空画布下 `.lc-runtime-root`
           根本不存在——既与参考不一致，也让"从画布取落点"的验证无从下手。 -->
      <RuntimeRenderer
        v-if="schema && runtime"
        :schema="schema"
        :context="runtime"
        :wrap-node="wrapNode"
        design-mode
      />
      <div v-if="isEmpty" class="lc-canvas__empty">
        <p class="lc-canvas__empty-title">从左侧拖入或点击组件</p>
        <p class="lc-canvas__empty-sub">开始搭建你的页面</p>
      </div>
    </div>

    <!-- Pad / H5：浅灰工作区 + 居中设备画布 + 深灰圆角边框 -->
    <div v-else class="lc-device-viewport" :style="viewportStyle">
      <div
        ref="canvasRef"
        class="lc-canvas lc-canvas--device"
        :class="{ 'lc-canvas--empty': isEmpty }"
        :style="deviceStyle"
        @drop="onDrop"
        @dragover="onDragOver"
      >
        <RuntimeRenderer
          v-if="schema && runtime"
          :schema="schema"
          :context="runtime"
          :wrap-node="wrapNode"
          design-mode
        />
        <div v-if="isEmpty" class="lc-canvas__empty">
          <p class="lc-canvas__empty-title">从左侧拖入或点击组件</p>
          <p class="lc-canvas__empty-sub">开始搭建你的页面</p>
        </div>
      </div>
    </div>

    <!-- 插入指示条：与 variant-form 的 ghost 一致（3px 主色条），渲染到 body 以避开画布缩放 -->
    <Teleport to="body">
      <div v-if="dropIndicator" class="lc-drop-indicator" :style="indicatorStyle" />
    </Teleport>
  </main>
</template>

<style scoped>
.lc-canvas-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: auto;
  box-sizing: border-box;
}

.lc-canvas-wrap--pc {
  padding: 0;
  background: #fff;
  /* 对齐参考实现：中栏两侧各有一条 2px 点线分隔
     （参考是 `.el-container.center-layout-container` 的 border-left/right:
       2px dotted #EBEEF5，它同时把内容宽从 1040 压到 1036）。
     `.lc-canvas-wrap` 是 border-box，所以这两条边框会等量吃掉画布宽度——
     这正是我们缺的那 4px。 */
  border-left: 2px dotted #ebeef5;
  border-right: 2px dotted #ebeef5;
}

.lc-canvas-wrap--pad,
.lc-canvas-wrap--h5 {
  padding: 24px;
  background: #f2f3f5;
}

.lc-canvas {
  background: #fff;
  box-sizing: border-box;
  /* 为节点外浮层（组件名/拖拽手柄等）留出空间，避免贴边被画布裁剪 */
  padding: 24px;
}

.lc-canvas--pc {
  width: 100%;
  height: 100%;
  overflow: auto;
  border: none;
  border-radius: 0;
  /* 对齐参考实现实测结构：画布底是**灰底 + 10px 内边距**，
     白色"表单面"由内部的 .lc-runtime-root 承担（见下）。
     此前这里是白底 + 24px 内边距，表单净宽 992，比参考的 1016 窄 24px。 */
  background: #f1f2f3;
  padding: 10px;
}

/* 白色"表单面"：对应参考实现的 .widget-form（白底 + 撑满容器）。
 *
 * ⚠️ 内边距是 6px 而不是 3px：参考在这一层之下还有一层
 *    `.form-widget-list { padding: 3px }`（节点列表），我们没有那一层 DOM。
 *    两层合起来 6px，所以这里用 6px 等价——**白面到节点的距离与参考一致**。
 *    参考：`.widget-form` 1016 → 3px → `.form-widget-list` 1010 → 3px → 节点 1004。 */
.lc-canvas--pc :deep(.lc-runtime-root) {
  box-sizing: border-box;
  min-height: 100%;
  padding: 6px;
  background: #fff;
}

.lc-canvas--device {
  overflow: auto;
  border: 10px solid #3c4043;
  border-radius: 22px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

.lc-device-viewport {
  margin: auto;
  flex-shrink: 0;
  overflow: hidden;
}

/*
 * ⚠️ `.lc-canvas--empty` 曾经是 `display: flex; align-items: center; justify-content: center`，
 * 用来居中那个空态提示。但画布现在是**始终**渲染 `.lc-runtime-root` 的
 * （与参考实现一致），把画布设成 flex 会让渲染器变成收缩到内容的 flex item ——
 * 空画布下实测只有 12px 宽（= padding 6×2），白面塌成一条。
 * 空态已改为绝对定位自居中，这里不再需要任何布局声明；
 * 类名保留作为状态标记。
 */
.lc-canvas--empty {
  /* 无布局副作用，见上 */
}
/* 空态浮在白色表单面之上：`.lc-runtime-root` 始终存在（与参考一致），
   提示只是它上面的一层。`pointer-events: none` 保证画布仍能接收 drop。 */
.lc-canvas {
  position: relative;
}
.lc-canvas__empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #86909c;
  pointer-events: none;
}
.lc-canvas__empty-title {
  font-size: 15px;
  color: #4e5969;
  margin: 0 0 8px;
}
.lc-canvas__empty-sub {
  font-size: 13px;
  margin: 0;
}

/*
 * 节点包装层：选中 / 悬停 / 拖拽 / 落点。
 * 选中态使用 outline（不参与布局），与 variant-form 的 `outline: 2px solid` 一致。
 */
:deep(.lc-node) {
  position: relative;
  outline: 1px dashed transparent;
  outline-offset: -1px;
  border-radius: 2px;
  transition: outline-color 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
}
:deep(.lc-node:hover) {
  outline-color: #3370ff;
}
:deep(.lc-node--selected) {
  outline: 2px solid #3370ff;
  outline-offset: -2px;
}
:deep(.lc-node--dragging) {
  opacity: 0.4;
}
:deep(.lc-node--drop-inside) {
  outline: 1px dashed #3370ff;
  outline-offset: -1px;
}

/* 内部结构节点（栅格列 / 表格行 / 单元格）：直接复用组件根元素 */
:deep(.lc-node--embedded) {
  cursor: pointer;
}
:deep(.lc-node--embedded.lc-node--selected) {
  outline: 2px solid #3370ff;
  outline-offset: -2px;
}
:deep(.lc-node--embedded.lc-node--hovered:not(.lc-node--selected)) {
  outline: 1px dashed #3370ff;
  outline-offset: -1px;
}
:deep(.lc-node--embedded.lc-node--drop-inside) {
  outline: 1px dashed #3370ff;
  outline-offset: -1px;
}

/* 左上角拖拽手柄（仅选中时出现，与 variant-form 位置/尺寸一致） */
:deep(.lc-node__badges) {
  position: absolute;
  top: -2px;
  left: -2px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 0 8px 0 6px;
  background: #3370ff;
  border-radius: 3px;
  cursor: move;
  user-select: none;
  z-index: 11;
}
:deep(.lc-node__rank) {
  font-size: 12px;
  font-style: normal;
  line-height: 1;
  color: #fff;
}
:deep(.lc-node__type) {
  font-size: 12px;
  font-style: normal;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
}
:deep(.lc-node__hidden) {
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  line-height: 14px;
}

/* 右下角操作组：← ↑ ↓ 复制 删除（仅选中时出现） */
:deep(.lc-node__actions) {
  position: absolute;
  bottom: -2px;
  right: -2px;
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 4px;
  background: #3370ff;
  border-radius: 3px;
  z-index: 10;
}
:deep(.lc-node__action) {
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.lc-node__action:hover) {
  opacity: 0.85;
}
:deep(.lc-node__action--disabled) {
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
  opacity: 0.65;
}
:deep(.lc-node__action--danger) {
  color: #ffb3b3;
}
</style>

<!-- 插入指示条被 Teleport 到 body，使用非 scoped 样式 -->
<style>
.lc-drop-indicator {
  position: fixed;
  z-index: 3500;
  pointer-events: none;
  background: #3370ff;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(51, 112, 255, 0.6);
  transition: left 0.08s ease, top 0.08s ease, width 0.08s ease, height 0.08s ease;
}
</style>
