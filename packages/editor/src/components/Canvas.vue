<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref } from 'vue'
import { RuntimeRenderer } from '@lowcode/runtime'
import type { PageNode } from '@lowcode/schema'
import { h, type VNode } from 'vue'
import { REGISTER_RECT_KEY, type NodeRectInfo, type NodeRectRegistry } from '../editor-keys'
import { useEditorStore } from '../store/editor'
import CanvasNode from './CanvasNode.vue'
import DropIndicator from './DropIndicator.vue'

const store = useEditorStore()
const canvasEl = ref<HTMLElement | null>(null)
const rectStore = reactive<NodeRectRegistry>({
  register: (id, rect) => {
    rectStore.rects.set(id, rect)
  },
  rects: new Map<string, NodeRectInfo>(),
})
const canvasRect = ref<DOMRect | null>(null)

// 框选（lasso）
const lassoStart = ref<{ x: number; y: number } | null>(null)
const lassoClient = ref<{ left: number; top: number; width: number; height: number } | null>(null)

const lassoLocal = computed(() => {
  if (!lassoClient.value || !canvasEl.value) return null
  const rect = canvasEl.value.getBoundingClientRect()
  return {
    left: (lassoClient.value.left - rect.left) / store.zoom,
    top: (lassoClient.value.top - rect.top) / store.zoom,
    width: lassoClient.value.width / store.zoom,
    height: lassoClient.value.height / store.zoom,
  }
})

function intersects(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  )
}

function onMouseDown(event: MouseEvent) {
  // 只在画布空白处开始框选
  if (event.button !== 0 || event.target !== canvasEl.value) return
  lassoStart.value = { x: event.clientX, y: event.clientY }
  lassoClient.value = {
    left: event.clientX,
    top: event.clientY,
    width: 0,
    height: 0,
  }
}

function onMouseMove(event: MouseEvent) {
  if (!lassoStart.value) return
  const start = lassoStart.value
  lassoClient.value = {
    left: Math.min(start.x, event.clientX),
    top: Math.min(start.y, event.clientY),
    width: Math.abs(event.clientX - start.x),
    height: Math.abs(event.clientY - start.y),
  }
}

function onMouseUp(event: MouseEvent) {
  const lasso = lassoClient.value
  lassoStart.value = null
  lassoClient.value = null
  if (!lasso || lasso.width < 4 || lasso.height < 4) return
  const hits = [...rectStore.rects.entries()]
    .filter(([, rect]) => intersects(rect, lasso))
    .map(([id]) => id)
  if (hits.length === 0) return
  if (event.shiftKey || event.metaKey) {
    store.selectNodes([...new Set([...store.selectedNodeIds, ...hits])])
  } else {
    store.selectNodes(hits)
  }
}

provide(REGISTER_RECT_KEY, rectStore)

const canvasStyle = computed(() => ({
  transform: `scale(${store.zoom})`,
  width: '720px',
  minHeight: '480px',
}))

function onRootDragOver(event: DragEvent) {
  if (!store.dragState || !canvasEl.value) return
  const rect = canvasEl.value.getBoundingClientRect()
  const target = store.computeDropTarget(
    null,
    { x: event.clientX, y: event.clientY },
    rect,
  )
  store.setDropTarget(target)
}

function onDrop() {
  const target = store.dropTarget
  const drag = store.dragState
  if (target && drag) {
    if (drag.source === 'material' && drag.materialType) {
      store.insertMaterial(drag.materialType, target)
    } else if (drag.source === 'canvas' && drag.nodeId) {
      store.moveNode(drag.nodeId, target)
    }
  }
  store.setDragState(null)
  store.setDropTarget(null)
}

function onDragLeave(event: DragEvent) {
  if (canvasEl.value && !canvasEl.value.contains(event.relatedTarget as Node | null)) {
    store.setDropTarget(null)
  }
}

function wrapNode(node: PageNode, inner: VNode): VNode {
  return h(CanvasNode, { node, depth: 0, key: node.id }, { default: () => inner })
}

function updateCanvasRect() {
  canvasRect.value = canvasEl.value?.getBoundingClientRect() ?? null
}

onMounted(() => {
  updateCanvasRect()
  window.addEventListener('resize', updateCanvasRect)
  window.addEventListener('scroll', updateCanvasRect, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateCanvasRect)
  window.removeEventListener('scroll', updateCanvasRect, true)
})

const runtime = computed(() => store.runtimeContext)
</script>

<template>
  <main class="lc-canvas-wrap">
    <div
      ref="canvasEl"
      class="lc-canvas"
      :style="canvasStyle"
      @mousedown.left.prevent="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @dragover.prevent="onRootDragOver"
      @drop.prevent="onDrop"
      @dragleave="onDragLeave"
    >
      <div v-if="!store.schema || !runtime" class="lc-canvas--empty" style="height: 480px">
        从左侧拖拽物料到画布，开始搭建页面
      </div>
      <RuntimeRenderer
        v-else
        :schema="store.schema"
        :context="runtime"
        :wrap-node="wrapNode"
      />
      <DropIndicator :target="store.dropTarget" :canvas-rect="canvasRect" />
      <div v-if="lassoLocal" class="lc-lasso" :style="lassoLocal" />
    </div>
  </main>
</template>
