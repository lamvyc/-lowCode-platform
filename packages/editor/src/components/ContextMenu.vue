<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useEditorStore } from '../store/editor'

const store = useEditorStore()

function onDocumentClick() {
  store.closeContextMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') store.closeContextMenu()
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

const menu = computed(() => store.contextMenu)

function copyNode() {
  const id = menu.value?.nodeId
  if (id) {
    store.selectNode(id)
    store.copySelected()
  }
  store.closeContextMenu()
}

function deleteNode() {
  const id = menu.value?.nodeId
  if (id) store.removeNodes([id])
  store.closeContextMenu()
}

function toggleLock() {
  const id = menu.value?.nodeId
  if (!id) return
  const node = store.schema?.nodes.find((n) => n.id === id)
  if (node) {
    store.updateNode(id, (n) => ({ ...n, meta: { ...(n.meta ?? {}), locked: !n.meta?.locked } }))
  }
  store.closeContextMenu()
}
</script>

<template>
  <div
    v-if="menu"
    class="lc-context-menu"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    @click.stop
  >
    <div class="lc-context-menu__item" @click="copyNode">复制</div>
    <div class="lc-context-menu__item" @click="deleteNode">删除</div>
    <div class="lc-context-menu__item" @click="toggleLock">锁定 / 解锁</div>
  </div>
</template>
