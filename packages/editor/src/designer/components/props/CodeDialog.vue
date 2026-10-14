<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElAlert, ElButton, ElDialog, ElMessage } from 'element-plus'
import CodeEditor from './CodeEditor.vue'
import type { CodeMode } from '../../code'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title: string
    mode?: CodeMode
    /** 打开时的初始代码 */
    code?: string
    /** 头部签名提示，如 `button1.onClick(event) {` */
    signature?: string
    /** 头部说明文案 */
    description?: string
    width?: string
  }>(),
  {
    mode: 'javascript',
    code: '',
    signature: '',
    description: '',
    width: '760px',
  },
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', code: string): void
}>()

const draft = ref('')
const editorRef = ref<InstanceType<typeof CodeEditor>>()

watch(
  () => props.visible,
  (visible) => {
    if (visible) draft.value = props.code ?? ''
  },
  { immediate: true },
)

function close(): void {
  emit('update:visible', false)
}

/** 保存前统一做语法检查，避免把坏代码写进 Schema */
function confirm(): void {
  if (editorRef.value?.hasErrors()) {
    ElMessage.error('代码存在语法错误，请修正后再保存')
    return
  }
  emit('confirm', draft.value)
  close()
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    :width="width"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="lc-code-dialog"
    @update:model-value="(value: boolean) => emit('update:visible', value)"
  >
    <el-alert
      v-if="signature"
      type="info"
      :closable="false"
      class="lc-code-dialog__signature"
      :title="signature"
    />
    <p v-if="description" class="lc-code-dialog__description">{{ description }}</p>

    <CodeEditor ref="editorRef" v-model="draft" :mode="mode" :rows="16" />

    <div class="lc-code-dialog__footer">
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="confirm">确定</el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.lc-code-dialog__signature :deep(.el-alert__title) {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}
.lc-code-dialog__description {
  margin: 4px 0 10px;
  font-size: 12px;
  color: #86909c;
  line-height: 18px;
}
.lc-code-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
