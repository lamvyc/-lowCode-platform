<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PageNode } from '@lowcode/schema'
import { REGISTER_RECT_KEY, type NodeRectInfo } from '../editor-keys'
import { useEditorStore } from '../store/editor'

const props = defineProps<{ node: PageNode; depth: number }>()
const store = useEditorStore()
const rectRegistry = inject(REGISTER_RECT_KEY, undefined)
const el = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null

function report() {
  if (!el.value || !rectRegistry) return
  const rect = el.value.getBoundingClientRect()
  const info: NodeRectInfo = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    depth: props.depth,
  }
  rectRegistry.register(props.node.id, info)
}

onMounted(() => {
  report()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(report)
    if (el.value) observer.observe(el.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => store.zoom, report)

function onNodeDragOver(event: DragEvent) {
  if (!el.value || !store.dragState) return
  if (props.node.meta?.locked && store.dragState.source === 'canvas') return
  const target = store.computeDropTarget(
    {
      node: props.node,
      rect: el.value.getBoundingClientRect(),
      depth: props.depth,
    },
    { x: event.clientX, y: event.clientY },
  )
  store.setDropTarget(target)
}

function onClick(event: MouseEvent) {
  if (props.node.meta?.locked) return
  store.selectNode(props.node.id, event.shiftKey || event.metaKey)
}

function onContext(event: MouseEvent) {
  store.openContextMenu(event.clientX, event.clientY, props.node.id)
}

function onDragStart(event: DragEvent) {
  if (props.node.meta?.locked) return
  store.setDragState({ source: 'canvas', nodeId: props.node.id })
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.node.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}
</script>

<template>
  <div
    ref="el"
    class="lc-node-wrap"
    :class="{
      'lc-node-wrap--selected': store.isSelected(node.id),
      'lc-node-wrap--hover': store.hoverNodeId === node.id,
      'lc-node-wrap--locked': node.meta?.locked,
    }"
    :draggable="!node.meta?.locked"
    @click.stop="onClick"
    @contextmenu.prevent="onContext"
    @dragover.stop.prevent="onNodeDragOver"
    @dragstart="onDragStart"
    @mouseenter="store.hoverNode(node.id)"
    @mouseleave="store.hoverNode(null)"
  >
    <div v-if="store.isSelected(node.id) || store.hoverNodeId === node.id" class="lc-node-tag">
      {{ node.type }}{{ node.meta?.locked ? ' 🔒' : '' }}
    </div>
    <slot />
  </div>
</template>
