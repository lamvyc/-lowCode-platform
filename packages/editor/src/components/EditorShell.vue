<script setup lang="ts">
import { initPlatform } from '../platform'
import { useEditorStore } from '../store/editor'
import { useKeyboardShortcuts } from '../composables/useKeyboard'
import Canvas from './Canvas.vue'
import ContextMenu from './ContextMenu.vue'
import MaterialPanel from './MaterialPanel.vue'
import OutlinePanel from './OutlinePanel.vue'
import Preview from './Preview.vue'
import PropsPanel from './PropsPanel.vue'
import Toolbar from './Toolbar.vue'

initPlatform()
const store = useEditorStore()
useKeyboardShortcuts()
</script>

<template>
  <div class="lc-editor">
    <Toolbar v-if="store.schema && !store.preview" />
    <div class="lc-editor__body">
      <MaterialPanel v-if="store.panelVisible.left && !store.preview" />
      <Canvas v-if="!store.preview" />
      <Preview v-else />
      <PropsPanel v-if="store.panelVisible.right && !store.preview" />
      <OutlinePanel v-if="store.panelVisible.outline && !store.preview" />
    </div>
    <ContextMenu v-if="store.contextMenu" />
  </div>
</template>
