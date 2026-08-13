<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElDialog } from 'element-plus'
import { generateVueSfc } from '@lowcode/codegen'
import { useEditorStore } from '../store/editor'
import MonacoEditor from './controls/MonacoEditor.vue'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useEditorStore()
const code = ref('// 正在生成…')
const visible = ref(true)

onMounted(async () => {
  if (!store.schema) return
  try {
    const result = await generateVueSfc(store.schema)
    code.value = result.code
  } catch (error) {
    code.value = `// 生成失败\n${error instanceof Error ? error.message : String(error)}`
  }
})

function close() {
  visible.value = false
  emit('close')
}
</script>

<template>
  <ElDialog
    :model-value="visible"
    title="生成 Vue SFC 代码"
    width="760px"
    @close="close"
  >
    <MonacoEditor :model-value="code" language="vue" :height="480" readonly />
  </ElDialog>
</template>
