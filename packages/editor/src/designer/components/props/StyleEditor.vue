<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { ElButton, ElMessage } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'
import { toPlainStyle, toStyleConfig } from '../../props-config'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const plainStyle = computed(() => toPlainStyle(props.node.style))
const draft = ref(JSON.stringify(plainStyle.value, null, 2))

watch(
  plainStyle,
  (value) => {
    draft.value = JSON.stringify(value, null, 2)
  },
  { deep: true },
)

function apply(): void {
  const text = draft.value.trim()
  if (!text) {
    ctx.updateNode(props.node.id, (node) => ({ ...node, style: undefined }))
    return
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    ctx.updateNode(props.node.id, (node) => ({ ...node, style: toStyleConfig(parsed) }))
    ElMessage.success('样式已应用')
  } catch (error) {
    ElMessage.error(`样式 JSON 非法：${error instanceof Error ? error.message : String(error)}`)
    draft.value = JSON.stringify(plainStyle.value, null, 2)
  }
}

function format(): void {
  try {
    draft.value = JSON.stringify(JSON.parse(draft.value), null, 2)
  } catch {
    ElMessage.error('样式 JSON 非法，无法格式化')
  }
}

function reset(): void {
  ctx.updateNode(props.node.id, (node) => ({ ...node, style: undefined }))
  draft.value = '{}'
}
</script>

<template>
  <div class="lc-style-editor">
    <textarea
      v-model="draft"
      class="lc-style-editor__input"
      rows="6"
      spellcheck="false"
      placeholder='如 {"borderRadius": "8px", "boxShadow": "0 2px 8px rgba(0,0,0,.08)"}'
      @change="apply"
    />
    <div class="lc-style-editor__bar">
      <span class="lc-style-editor__hint">普通 CSS 值会自动包装为静态绑定</span>
      <el-button size="small" text @click="format">格式化</el-button>
      <el-button size="small" text @click="reset">清空</el-button>
    </div>
  </div>
</template>

<style scoped>
.lc-style-editor {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.lc-style-editor__input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  color: #1f2329;
}
.lc-style-editor__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-top: 1px solid #ebeef5;
  background: #f5f7fa;
}
.lc-style-editor__hint {
  flex: 1;
  font-size: 11px;
  color: #86909c;
}
</style>
