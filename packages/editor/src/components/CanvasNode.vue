<script setup lang="ts">
import type { PageNode } from '@lowcode/schema'
import { useNodeGeometry } from '../composables/useNodeGeometry'
import { useEditorStore } from '../store/editor'

const props = defineProps<{ node: PageNode; depth: number }>()
const store = useEditorStore()
const { el } = useNodeGeometry(props.node.id, props.depth)

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
