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
    </div>
  </main>
</template>
