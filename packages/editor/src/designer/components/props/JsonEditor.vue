<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElButton, ElMessage } from 'element-plus'

const props = withDefaults(
  defineProps<{
    modelValue?: unknown
    rows?: number
    placeholder?: string
  }>(),
  {
    modelValue: undefined,
    rows: 6,
    placeholder: '请输入合法 JSON',
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>()

function stringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

const draft = ref(stringify(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    // 仅在外部值真正变化（撤销 / 切换节点 / 保存成功）时同步，避免打断输入
    draft.value = stringify(value)
  },
  { deep: true },
)

function apply(): void {
  const text = draft.value.trim()
  if (!text) {
    emit('update:modelValue', undefined)
    return
  }
  try {
    emit('update:modelValue', JSON.parse(text))
  } catch (error) {
    ElMessage.error(`JSON 非法：${error instanceof Error ? error.message : String(error)}`)
    draft.value = stringify(props.modelValue)
  }
}

function format(): void {
  try {
    draft.value = JSON.stringify(JSON.parse(draft.value), null, 2)
  } catch {
    ElMessage.error('JSON 非法，无法格式化')
  }
}
</script>

<template>
  <div class="lc-json-editor">
    <textarea
      v-model="draft"
      class="lc-json-editor__input"
      :rows="rows"
      :placeholder="placeholder"
      spellcheck="false"
      @change="apply"
    />
    <div class="lc-json-editor__bar">
      <span class="lc-json-editor__hint">失焦后校验并写入</span>
      <el-button size="small" text @click="format">格式化</el-button>
    </div>
  </div>
</template>

<style scoped>
.lc-json-editor {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.lc-json-editor__input {
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
.lc-json-editor__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-top: 1px solid #ebeef5;
  background: #f5f7fa;
}
.lc-json-editor__hint {
  flex: 1;
  font-size: 11px;
  color: #86909c;
}
</style>
