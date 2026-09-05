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
import type { DropOver } from '../../engine/editor-engine'
import { DEVICE_BORDER, deviceDimension } from '../device'
import { materialRegistry } from '../../platform'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const {
  engine,
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

const wrapNode = computed(() => {
  return (node: PageNode, inner: VNode): VNode => {
    const isSelected = state.selectedNodeId === node.id
    const isHovered = state.hoverNodeId === node.id
    const typeLabel = materialRegistry.get(node.type)?.name ?? node.type
    const drop = state.dropTarget
    const isDropInside = drop?.targetId === node.id && drop.position === 'inside'
    const isDropBefore = drop?.targetId === node.id && drop.position === 'before'
    const isDropAfter = drop?.targetId === node.id && drop.position === 'after'
    const hasParent = ctx.getParentId(node.id) !== null
    const upEnabled = canMoveUp(node.id)
    const downEnabled = canMoveDown(node.id)

    return h(
      'div',
      {
        class: [
          'lc-node',
          isSelected ? 'lc-node--selected' : '',
          isHovered ? 'lc-node--hovered' : '',
          isDropInside ? 'lc-node--drop-inside' : '',
          isDropBefore ? 'lc-node--drop-before' : '',
          isDropAfter ? 'lc-node--drop-after' : '',
        ],
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
        h(
          'div',
          {
            class: 'lc-node__badges',
            draggable: 'true',
            title: '拖动',
            onDragstart: (event: DragEvent) => {
              event.stopPropagation()
              if (event.dataTransfer) {
                event.dataTransfer.setData('application/x-lc-node', node.id)
                event.dataTransfer.effectAllowed = 'move'
              }
              setDragState({ source: 'canvas', nodeId: node.id })
            },
            onDragend: () => {
              setDragState(null)
              setDropTarget(null)
            },
          },
          [
            h(
              'div',
              {
                class: 'lc-node__handle',
              },
              '⠿',
            ),
            h('div', { class: 'lc-node__type' }, typeLabel),
          ],
        ),
        ...(isSelected
          ? [
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
})
onBeforeUnmount(() => observer?.disconnect())
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

/** 计算拖拽落点（把指针/节点 rect 转换到画布坐标系） */
function computeDropTarget(event: DragEvent): DropTarget | null {
  const ds = state.dragState
  const canvasEl = wrapRef.value
  if (!ds || !canvasEl) return null
  const canvasRect = canvasEl.getBoundingClientRect()

  const targetEl = (event.target as HTMLElement | null)?.closest?.(
    '[data-node-id]',
  ) as HTMLElement | null
  let over: DropOver | null = null
  if (targetEl?.dataset.nodeId) {
    const node = schema.value.nodes.find((n) => n.id === targetEl.dataset.nodeId)
    if (node) {
      const rect = targetEl.getBoundingClientRect()
      over = {
        node,
        rect: {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          width: rect.width,
          height: rect.height,
        },
      }
    }
  }

  const pointer = {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  }
  return engine.computeDropTarget(ds, over, pointer, {
    left: 0,
    top: 0,
    width: canvasRect.width,
    height: canvasRect.height,
  })
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (!state.dragState) return
  setDropTarget(computeDropTarget(event))
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const ds = state.dragState
  const target = state.dropTarget
  if (ds && target) {
    if (ds.source === 'material' && ds.materialType) {
      insertMaterial(ds.materialType, target)
    } else if (ds.source === 'canvas' && ds.nodeId) {
      moveNode(ds.nodeId, target)
    }
  } else {
    const materialType = event.dataTransfer?.getData('application/x-lc-material')
    if (materialType) insertMaterial(materialType)
  }
  setDragState(null)
  setDropTarget(null)
}

function onDragEnd(): void {
  setDragState(null)
  setDropTarget(null)
}
</script>

<template>
  <main
    ref="wrapRef"
    class="lc-canvas-wrap"
    :class="`lc-canvas-wrap--${state.device}`"
    @dragend="onDragEnd"
  >
    <!-- PC：白色画布铺满工作区 -->
    <div
      v-if="state.device === 'pc'"
      class="lc-canvas lc-canvas--pc"
      :class="{ 'lc-canvas--empty': isEmpty, 'lc-canvas--drop-root': state.dropTarget?.position === 'root' }"
      :style="{ zoom: state.zoom }"
      @click="selectNode(null)"
      @drop="onDrop"
      @dragover="onDragOver"
    >
      <RuntimeRenderer
        v-if="schema && runtime && !isEmpty"
        :schema="schema"
        :context="runtime"
        :wrap-node="wrapNode"
      />
      <div v-if="isEmpty" class="lc-canvas__empty">
        <p class="lc-canvas__empty-title">从左侧拖入或点击组件</p>
        <p class="lc-canvas__empty-sub">开始搭建你的页面</p>
      </div>
    </div>

    <!-- Pad / H5：浅灰工作区 + 居中设备画布 + 深灰圆角边框 -->
    <div v-else class="lc-device-viewport" :style="viewportStyle">
      <div
        class="lc-canvas lc-canvas--device"
        :class="{ 'lc-canvas--empty': isEmpty, 'lc-canvas--drop-root': state.dropTarget?.position === 'root' }"
        :style="deviceStyle"
        @click="selectNode(null)"
        @drop="onDrop"
        @dragover="onDragOver"
      >
        <RuntimeRenderer
          v-if="schema && runtime && !isEmpty"
          :schema="schema"
          :context="runtime"
          :wrap-node="wrapNode"
        />
        <div v-if="isEmpty" class="lc-canvas__empty">
          <p class="lc-canvas__empty-title">从左侧拖入或点击组件</p>
          <p class="lc-canvas__empty-sub">开始搭建你的页面</p>
        </div>
      </div>
    </div>
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

.lc-canvas--drop-root {
  box-shadow: inset 0 3px 0 #3370ff;
}

.lc-canvas--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-canvas__empty {
  text-align: center;
  color: #86909c;
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

/* 节点包装层：选中/悬停/落点边框 */
:deep(.lc-node) {
  position: relative;
  border: 1px dashed transparent;
  border-radius: 2px;
  transition: border-color 0.15s ease;
  cursor: pointer;
}
:deep(.lc-node:hover) {
  border-color: #3370ff;
}
:deep(.lc-node--selected) {
  border: 1px solid #3370ff;
}

/* 左上角浮层组：拖拽手柄 → 组件名称（hover 显示手柄，选中后连名称一起显示） */
:deep(.lc-node__badges) {
  position: absolute;
  top: -22px;
  left: -1px;
  display: none;
  align-items: center;
  padding: 5px 10px 5px 7px;
  background: #3370ff;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  z-index: 11;
}
:deep(.lc-node:hover .lc-node__badges),
:deep(.lc-node--selected .lc-node__badges) {
  display: flex;
}

/* 组件类型标识 */
:deep(.lc-node__type) {
  display: none;
  padding-left: 12px;
  font-size: 12px;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
}
:deep(.lc-node--selected .lc-node__type) {
  display: block;
}

/* 拖拽字形（整条 .lc-node__badges 均可拖，此处仅负责左侧视觉） */
:deep(.lc-node__handle) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  line-height: 1;
}

/* 右下角操作组：整条蓝色标签，内部依次为 ← ↑ ↓ 复制 删除 */
:deep(.lc-node__actions) {
  position: absolute;
  bottom: -26px;
  right: -1px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  background: #3370ff;
  border-radius: 4px;
  z-index: 10;
}
:deep(.lc-node__action) {
  min-width: 24px;
  height: 22px;
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
  color: #ff7875;
}

/* 落点指示 */
:deep(.lc-node--drop-inside) {
  outline: 2px dashed #3370ff;
  outline-offset: 1px;
  border-color: #3370ff;
}
:deep(.lc-node--drop-before) {
  box-shadow: 0 -3px 0 #3370ff;
}
:deep(.lc-node--drop-after) {
  box-shadow: 0 3px 0 #3370ff;
}
</style>
