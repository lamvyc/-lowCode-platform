<script setup lang="ts">
import { materialRegistry } from '../platform'
import { useEditorStore } from '../store/editor'

const store = useEditorStore()
const categories = materialRegistry.categories()

function onDragStart(event: DragEvent, type: string) {
  store.setDragState({ source: 'material', materialType: type })
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<template>
  <aside class="lc-panel lc-panel--left">
    <div class="lc-panel__title">物料面板</div>
    <div v-for="category in categories" :key="category">
      <div style="padding: 8px 12px 0; font-size: 12px; color: #86909c">{{ category }}</div>
      <div
        v-for="material in materialRegistry.list(category)"
        :key="material.type"
        class="lc-material-item"
        draggable="true"
        @dragstart="onDragStart($event, material.type)"
      >
        <span class="lc-material-item__icon">{{ material.icon }}</span>
        <span>{{ material.name }}</span>
      </div>
    </div>
  </aside>
</template>
