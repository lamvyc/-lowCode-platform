<script setup lang="ts">
import { computed, inject } from 'vue'
import type { DropTarget } from '@lowcode/core'
import { REGISTER_RECT_KEY, type NodeRectRegistry } from '../editor-keys'

const props = defineProps<{ target: DropTarget | null; canvasRect: DOMRect | null }>()

const rectRegistry = inject(REGISTER_RECT_KEY, undefined) as NodeRectRegistry | undefined

const style = computed(() => {
  if (!props.target || !props.canvasRect) return null
  const { position, targetId, parentId } = props.target
  const canvas = props.canvasRect

  if (position === 'root') {
    return {
      left: 2,
      top: 2,
      width: canvas.width - 4,
      height: canvas.height - 4,
      kind: 'inside',
    }
  }

  const id = position === 'inside' ? parentId : targetId
  const info = id ? rectRegistry?.rects.get(id) : undefined
  if (!info) return null
  const left = info.left - canvas.left
  const top = info.top - canvas.top

  if (position === 'inside') {
    return { left, top, width: info.width, height: info.height, kind: 'inside' }
  }
  return {
    left,
    top: position === 'before' ? top - 2 : top + info.height - 2,
    width: info.width,
    height: 2,
    kind: 'line',
  }
})
</script>

<template>
  <div
    v-if="style"
    class="lc-drop-indicator"
    :class="style.kind === 'inside' ? 'lc-drop-indicator--inside' : 'lc-drop-indicator--line'"
    :style="{ left: `${style.left}px`, top: `${style.top}px`, width: `${style.width}px`, height: `${style.height}px` }"
  />
</template>
