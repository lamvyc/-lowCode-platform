<script setup lang="ts">
import { provide } from 'vue'
import { ElButton } from 'element-plus'
import type { PageSchema } from '@lowcode/schema'
import { RuntimeRenderer } from '@lowcode/runtime'
import { DESIGNER_KEY, useDesigner } from './useDesigner'
import Toolbar from './components/Toolbar.vue'
import MaterialPanel from './components/MaterialPanel.vue'
import Canvas from './components/Canvas.vue'
import PropsPanel from './components/PropsPanel.vue'

const props = defineProps<{ schema: PageSchema }>()

const ctx = useDesigner({ schema: props.schema })
provide(DESIGNER_KEY, ctx)

const { state, schema, runtime, togglePreview } = ctx
</script>

<template>
  <div v-if="state.preview" class="lc-designer lc-designer--preview">
    <div class="lc-preview-bar">
      <span class="lc-preview-bar__title">预览模式</span>
      <el-button type="primary" @click="togglePreview()">返回编辑</el-button>
    </div>
    <div class="lc-preview-body">
      <RuntimeRenderer v-if="schema && runtime" :schema="schema" :context="runtime" />
    </div>
  </div>

  <div v-else class="lc-designer">
    <Toolbar />
    <div class="lc-designer__body">
      <MaterialPanel />
      <Canvas />
      <PropsPanel />
    </div>
  </div>
</template>

<style scoped>
.lc-designer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2f3f5;
}
.lc-designer__body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.lc-designer--preview {
  background: #f2f3f5;
}
.lc-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
}
.lc-preview-bar__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.lc-preview-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
}
</style>
