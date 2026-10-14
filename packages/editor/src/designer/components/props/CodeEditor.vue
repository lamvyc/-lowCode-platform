<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElButton } from 'element-plus'
import {
  CODE_MODE_LABELS,
  CODE_MODE_PLACEHOLDERS,
  formatCode,
  validateCode,
  type CodeAnnotation,
  type CodeMode,
} from '../../code'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    mode?: CodeMode
    readonly?: boolean
    rows?: number
    /** 是否展示底部语法检查结果 */
    showAnnotations?: boolean
  }>(),
  {
    modelValue: '',
    mode: 'javascript',
    readonly: false,
    rows: 12,
    showAnnotations: true,
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const textareaRef = ref<HTMLTextAreaElement>()
const gutterRef = ref<HTMLDivElement>()
const annotations = ref<CodeAnnotation[]>([])

const code = computed(() => props.modelValue ?? '')
const lineNumbers = computed(() =>
  Array.from({ length: Math.max(1, code.value.split('\n').length) }, (_, index) => index + 1),
)
const modeLabel = computed(() => CODE_MODE_LABELS[props.mode])
const placeholder = computed(() => CODE_MODE_PLACEHOLDERS[props.mode])

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function syncScroll(): void {
  if (gutterRef.value && textareaRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

/** Tab 键插入两个空格，保持缩进手感 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || props.readonly) return
  event.preventDefault()
  const textarea = event.target as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const next = `${code.value.slice(0, start)}  ${code.value.slice(end)}`
  emit('update:modelValue', next)
  void nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + 2
  })
}

/** 语法检查：返回全部注解（供对话框保存前调用） */
function getEditorAnnotations(): CodeAnnotation[] {
  annotations.value = validateCode(code.value, props.mode)
  return annotations.value
}

/** 是否存在语法错误 */
function hasErrors(): boolean {
  return getEditorAnnotations().some((item) => item.type === 'error')
}

function doFormat(): void {
  const formatted = formatCode(code.value, props.mode)
  if (formatted !== code.value) emit('update:modelValue', formatted)
  getEditorAnnotations()
}

function focus(): void {
  textareaRef.value?.focus()
}

defineExpose({ getEditorAnnotations, hasErrors, format: doFormat, focus })
</script>

<template>
  <div class="lc-code-editor">
    <div class="lc-code-editor__bar">
      <span class="lc-code-editor__mode">{{ modeLabel }}</span>
      <span class="lc-code-editor__spacer" />
      <el-button v-if="mode === 'json'" size="small" text @click="doFormat">格式化</el-button>
      <el-button size="small" text @click="getEditorAnnotations">检查语法</el-button>
    </div>

    <div class="lc-code-editor__body">
      <div ref="gutterRef" class="lc-code-editor__gutter" aria-hidden="true">
        <span v-for="line in lineNumbers" :key="line">{{ line }}</span>
      </div>
      <textarea
        ref="textareaRef"
        class="lc-code-editor__input"
        :value="code"
        :rows="rows"
        :readonly="readonly"
        :placeholder="placeholder"
        spellcheck="false"
        wrap="off"
        @input="onInput"
        @scroll="syncScroll"
        @keydown="onKeydown"
      />
    </div>

    <ul v-if="showAnnotations && annotations.length > 0" class="lc-code-editor__annotations">
      <li
        v-for="(item, index) in annotations"
        :key="index"
        :class="`lc-code-editor__annotation lc-code-editor__annotation--${item.type}`"
      >
        <span class="lc-code-editor__annotation-type">{{ item.type === 'error' ? '错误' : '警告' }}</span>
        <span v-if="item.line">第 {{ item.line }} 行：</span>
        {{ item.message }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lc-code-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fafbfc;
}
.lc-code-editor__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 2px 10px;
  border-bottom: 1px solid #ebeef5;
  background: #f5f7fa;
}
.lc-code-editor__mode {
  font-size: 12px;
  color: #86909c;
  letter-spacing: 0.4px;
}
.lc-code-editor__spacer {
  flex: 1;
}
.lc-code-editor__body {
  display: flex;
  min-height: 0;
}
.lc-code-editor__gutter {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 36px;
  padding: 8px 6px 8px 0;
  overflow: hidden;
  text-align: right;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  color: #c0c4cc;
  background: #f7f8fa;
  border-right: 1px solid #ebeef5;
  user-select: none;
}
.lc-code-editor__input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 18px;
  color: #1f2329;
  background: #fff;
  white-space: pre;
  tab-size: 2;
}
.lc-code-editor__annotations {
  margin: 0;
  padding: 6px 10px;
  list-style: none;
  border-top: 1px solid #ebeef5;
  background: #fff;
  max-height: 90px;
  overflow-y: auto;
}
.lc-code-editor__annotation {
  font-size: 12px;
  line-height: 18px;
  word-break: break-all;
}
.lc-code-editor__annotation--error {
  color: #f53f3f;
}
.lc-code-editor__annotation--warning {
  color: #ff7d00;
}
.lc-code-editor__annotation-type {
  display: inline-block;
  margin-right: 6px;
  padding: 0 4px;
  border-radius: 2px;
  background: #ffece8;
  color: #f53f3f;
  font-size: 11px;
}
.lc-code-editor__annotation--warning .lc-code-editor__annotation-type {
  background: #fff7e8;
  color: #ff7d00;
}
</style>
