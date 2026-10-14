<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElButton } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcRichEditor' })

const props = withDefaults(
  defineProps<{
    /** 字段标签 */
    label?: string
    /** 标签宽度（px）；为空时按内容自适应 */
    labelWidth?: number | null
    /** 是否隐藏标签 */
    labelHidden?: boolean
    /** 标签对齐方式 */
    labelAlign?: 'left' | 'center' | 'right'
    /** 是否必填 */
    required?: boolean
    /** 必填提示 */
    requiredHint?: string
    /** 校验提示 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 自定义校验提示；validationHint 为空时作为校验提示展示 */
    customRuleHint?: string
    /** 富文本内容（HTML 字符串） */
    modelValue?: string
    /** 占位文案 */
    placeholder?: string
    /** 是否禁用编辑 */
    disabled?: boolean
    /** 最少字数 */
    minLength?: number | null
    /** 最多字数（配合 showWordLimit 显示字数统计） */
    maxLength?: number | null
    /** 是否显示字数统计 */
    showWordLimit?: boolean
  }>(),
  {
    label: '',
    labelWidth: null,
    labelHidden: false,
    labelAlign: 'left',
    required: false,
    requiredHint: '',
    validationHint: '',
    columnWidth: '',
    customRuleHint: '',
    modelValue: '',
    placeholder: '请输入内容',
    disabled: false,
    minLength: null,
    maxLength: null,
    showWordLimit: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

/** 校验提示：自定义规则提示作为兜底 */
const hintText = computed(() => props.validationHint || props.customRuleHint)

const editorRef = ref<HTMLDivElement | null>(null)

/** 当前内容，作为字数统计的来源（父组件未回写 modelValue 时也能实时反映） */
const content = ref(props.modelValue || '')

/** 同步编辑区 HTML；内容一致时不写入，避免打断正在进行的输入 */
const syncContent = (value: string) => {
  const next = value || ''
  content.value = next
  const el = editorRef.value
  if (el && el.innerHTML !== next) el.innerHTML = next
}

watch(
  () => props.modelValue,
  (value) => {
    syncContent(value)
  },
)

onMounted(() => {
  syncContent(props.modelValue)
})

/** 按纯文本统计字数（去掉标签与 &nbsp;） */
const countPlainText = (html: string): number => {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ')
  return text.length
}

const maxLengthValue = computed(() =>
  typeof props.maxLength === 'number' ? props.maxLength : null,
)

const currentLength = computed(() => countPlainText(content.value))

const showCount = computed(() => props.showWordLimit && maxLengthValue.value !== null)

const isOverLimit = computed(
  () => maxLengthValue.value !== null && currentLength.value > maxLengthValue.value,
)

const handleInput = () => {
  const el = editorRef.value
  if (!el) return
  content.value = el.innerHTML
  emit('update:modelValue', content.value)
  emit('change', content.value)
}

/** 执行浏览器原生编辑命令 */
const execCommand = (command: string, value?: string) => {
  if (props.disabled) return
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  handleInput()
}

const handleInsertLink = () => {
  if (props.disabled) return
  const url = window.prompt('请输入链接地址', 'https://')
  if (!url) return
  execCommand('createLink', url)
}
</script>

<template>
  <FormItem
    :label="label"
    :label-width="labelWidth"
    :label-hidden="labelHidden"
    :label-align="labelAlign"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="hintText"
    :column-width="columnWidth"
  >
    <div class="lc-rich-editor" :class="{ 'is-disabled': disabled }">
      <div class="lc-rich-editor__toolbar">
        <ElButton size="small" :disabled="disabled" @click="execCommand('bold')">加粗</ElButton>
        <ElButton size="small" :disabled="disabled" @click="execCommand('italic')">斜体</ElButton>
        <ElButton size="small" :disabled="disabled" @click="execCommand('underline')">
          下划线
        </ElButton>
        <ElButton size="small" :disabled="disabled" @click="execCommand('insertOrderedList')">
          有序列表
        </ElButton>
        <ElButton size="small" :disabled="disabled" @click="execCommand('insertUnorderedList')">
          无序列表
        </ElButton>
        <ElButton size="small" :disabled="disabled" @click="execCommand('removeFormat')">
          清除格式
        </ElButton>
        <ElButton size="small" :disabled="disabled" @click="handleInsertLink">插入链接</ElButton>
      </div>
      <div
        ref="editorRef"
        class="lc-rich-editor__content"
        :contenteditable="!disabled"
        :data-placeholder="placeholder"
        @input="handleInput"
      ></div>
      <div v-if="showCount" class="lc-rich-editor__count" :class="{ 'is-over': isOverLimit }">
        {{ currentLength }}/{{ maxLengthValue }}
      </div>
    </div>
  </FormItem>
</template>

<style scoped>
.lc-rich-editor {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
}
.lc-rich-editor.is-disabled {
  background-color: #f5f7fa;
}
.lc-rich-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 6px;
  border-bottom: 1px solid #dcdfe6;
}
.lc-rich-editor__content {
  box-sizing: border-box;
  min-height: 120px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 22px;
  color: #1d2129;
  outline: none;
  overflow-y: auto;
  word-break: break-word;
}
.lc-rich-editor__content:empty::before {
  content: attr(data-placeholder);
  color: #a8abb2;
  pointer-events: none;
}
.lc-rich-editor__count {
  padding: 2px 8px 4px;
  font-size: 11px;
  line-height: 16px;
  text-align: right;
  color: #86909c;
}
.lc-rich-editor__count.is-over {
  color: #f53f3f;
}
</style>
