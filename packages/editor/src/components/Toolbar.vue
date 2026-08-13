<script setup lang="ts">
import { ElButton } from 'element-plus'
import { ref } from 'vue'
import type { PageSchema } from '@lowcode/schema'
import { useEditorStore } from '../store/editor'
import CodeDialog from './CodeDialog.vue'

const store = useEditorStore()
const codeDialogVisible = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

function exportJson() {
  if (!store.schema) return
  const blob = new Blob([JSON.stringify(store.schema, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.schema.meta.name || 'page'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      store.loadSchema(JSON.parse(String(reader.result)) as PageSchema)
    } catch (error) {
      window.alert(`导入失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  reader.readAsText(file)
  if (importInput.value) importInput.value.value = ''
}
</script>

<template>
  <header
    style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fff;
      border-bottom: 1px solid #e5e6eb;
    "
  >
    <strong>{{ store.schema?.meta.name ?? '低代码平台' }}</strong>
    <span
      v-if="store.dirty"
      style="font-size: 12px; color: #ff9a2e"
    >未保存</span>
    <span style="flex: 1" />
    <ElButton size="small" :disabled="!store.canUndo" @click="store.undo()">撤销</ElButton>
    <ElButton size="small" :disabled="!store.canRedo" @click="store.redo()">重做</ElButton>
    <ElButton size="small" @click="store.setZoom(store.zoom - 0.1)">-</ElButton>
    <span style="font-size: 12px">{{ Math.round(store.zoom * 100) }}%</span>
    <ElButton size="small" @click="store.setZoom(store.zoom + 0.1)">+</ElButton>
    <ElButton size="small" @click="store.togglePreview()">预览</ElButton>
    <ElButton size="small" type="primary" @click="store.save()">保存</ElButton>
    <ElButton size="small" @click="exportJson">导出 JSON</ElButton>
    <ElButton size="small" @click="importInput?.click()">导入 JSON</ElButton>
    <ElButton size="small" @click="codeDialogVisible = true">生成代码</ElButton>
    <input ref="importInput" type="file" accept=".json" style="display: none" @change="onImportFile" />
    <CodeDialog v-if="codeDialogVisible" @close="codeDialogVisible = false" />
  </header>
</template>
