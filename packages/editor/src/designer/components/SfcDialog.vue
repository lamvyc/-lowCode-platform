<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElAlert, ElButton, ElDialog, ElMessage, ElTabPane, ElTabs } from 'element-plus'
import type { PageSchema } from '@lowcode/schema'
import type { CodeMode } from '../code'
import CodeEditor from './props/CodeEditor.vue'

const props = defineProps<{
  modelValue: boolean
  schema: PageSchema
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

interface GeneratedParts {
  filename: string
  code: string
  template: string
  script: string
  style: string
  warnings?: Array<{ code: string; message: string; nodeId?: string }>
}

type PartKey = 'sfc' | 'template' | 'script' | 'style'

const PARTS: ReadonlyArray<{ key: PartKey; label: string; mode: CodeMode }> = [
  { key: 'sfc', label: '完整 SFC', mode: 'html' },
  { key: 'template', label: 'Template', mode: 'html' },
  { key: 'script', label: 'Script', mode: 'javascript' },
  { key: 'style', label: 'Style', mode: 'css' },
]

const loading = ref(false)
const error = ref('')
const parts = ref<GeneratedParts | null>(null)
const activeTab = ref<PartKey>('sfc')

/** 懒加载 codegen：prettier 体积较大，独立分包，仅在真正生成时下载 */
async function generate(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const { generateVueSfc } = await import('@lowcode/codegen')
    const snapshot = JSON.parse(JSON.stringify(props.schema)) as PageSchema
    parts.value = (await generateVueSfc(snapshot)) as GeneratedParts
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : String(exception)
    parts.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void generate()
  },
  { immediate: true },
)

const activeMode = computed<CodeMode>(
  () => PARTS.find((part) => part.key === activeTab.value)?.mode ?? 'html',
)

const currentCode = computed(() => {
  if (!parts.value) return ''
  return activeTab.value === 'sfc' ? parts.value.code : parts.value[activeTab.value]
})

const lineCount = computed(() => currentCode.value.split('\n').length)
const charCount = computed(() => currentCode.value.length)

function close(): void {
  emit('update:modelValue', false)
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(currentCode.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

function download(): void {
  if (!parts.value) return
  const suffix =
    activeTab.value === 'sfc'
      ? 'vue'
      : activeTab.value === 'style'
        ? 'css'
        : activeTab.value === 'script'
          ? 'js'
          : 'html'
  const blob = new Blob([currentCode.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${props.schema.meta.name || 'page'}.${suffix}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="生成 SFC"
    width="72%"
    append-to-body
    destroy-on-close
    draggable
    class="lc-sfc-dialog lc-draggable-dialog"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <el-alert
      type="info"
      :closable="false"
      title="由当前页面 Schema 生成 Vue 3 单文件组件（Template + Script setup + Style）"
      class="lc-sfc-dialog__alert"
    />

    <el-alert
      v-if="parts?.warnings?.length"
      type="warning"
      :closable="false"
      class="lc-sfc-dialog__warnings"
    >
      <template #title>生成告警（{{ parts.warnings.length }}）</template>
      <ul class="lc-sfc-dialog__warning-list">
        <li v-for="(warning, index) in parts.warnings" :key="`${warning.code}-${index}`">
          {{ warning.message }}
        </li>
      </ul>
    </el-alert>

    <p v-if="loading" class="lc-sfc-dialog__status">正在生成 SFC…</p>
    <el-alert v-else-if="error" type="error" :closable="false" :title="`生成失败：${error}`" />

    <template v-else-if="parts">
      <div class="lc-sfc-dialog__meta">
        <span>{{ parts.filename }}</span>
        <span>{{ lineCount }} 行 / {{ charCount }} 字符</span>
      </div>

      <el-tabs v-model="activeTab" class="lc-sfc-dialog__tabs">
        <el-tab-pane v-for="part in PARTS" :key="part.key" :label="part.label" :name="part.key" />
      </el-tabs>

      <CodeEditor :model-value="currentCode" :mode="activeMode" readonly :rows="20" :show-annotations="false" />
    </template>

    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button :disabled="!parts" @click="copyCode">复制</el-button>
      <el-button type="primary" :disabled="!parts" @click="download">下载文件</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.lc-sfc-dialog__alert {
  margin-bottom: 10px;
}
.lc-sfc-dialog__warnings {
  margin-bottom: 10px;
}
.lc-sfc-dialog__warning-list {
  margin: 0;
  padding-left: 18px;
  max-height: 120px;
  overflow: auto;
  font-size: 12px;
}
.lc-sfc-dialog__status {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #86909c;
}
.lc-sfc-dialog__meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #86909c;
}
.lc-sfc-dialog__tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
</style>
