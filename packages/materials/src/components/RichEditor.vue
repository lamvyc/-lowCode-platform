<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcRichEditor' })

/**
 * 富文本编辑器 —— 改用 **Quill**（`@vueup/vue-quill`）。
 *
 * 为什么换：参考实现（`rich-editor-widget.vue`）用的是 `vue2-editor`（Quill 封装），
 * 带 **完整的默认工具栏**（实测 9 组、22 个按钮/选择器）。我们此前是 230 行自建的
 * `contenteditable` + `document.execCommand`，只有 7 个按钮，且 **execCommand 已被废弃**。
 *
 * 这不是外观差异而是**能力差距**，所以选择换掉而不是调 CSS 去凑。
 */
const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
    onValidate?: string
    onMounted?: string
    /** 字段标签 */
    label?: string
    /** 标签宽度（px）；为空时按内容自适应 */
    labelWidth?: number | null
    /** 是否隐藏标签 */
    labelHidden?: boolean
    /** 标签对齐方式 */
    labelAlign?: 'left' | 'center' | 'right'
    /** 标签图标 class（如 el-icon-user） */
    labelIconClass?: string
    /** 标签图标位置：前置 / 后置 */
    labelIconPosition?: 'front' | 'rear'
    /** 标签悬浮提示 */
    labelTooltip?: string
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

/**
 * 工具栏：对齐参考实测的 9 组（标题 / 粗斜下划删除 / 对齐 / 引用与代码块 /
 * 列表 / 缩进 / 颜色与背景 / 链接图片视频 / 清除格式）。
 */
const TOOLBAR = [
  [{ header: [false, 1, 2, 3, 4, 5, 6] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ color: [] }, { background: [] }],
  ['link', 'image', 'video'],
  ['clean'],
]

/** 当前 HTML 内容：既作为字数统计来源，也用于回写 */
const inner = ref(props.modelValue || '')

watch(
  () => props.modelValue,
  (value) => {
    // 内容一致时不写入，避免打断正在进行的输入
    if ((value || '') !== inner.value) inner.value = value || ''
  },
)

function handleUpdate(value: string): void {
  inner.value = value || ''
  emit('update:modelValue', inner.value)
  emit('change', inner.value)
}

/** 按纯文本统计字数（去掉标签与 &nbsp;） */
const countPlainText = (html: string): number =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').length

const maxLengthValue = computed(() =>
  typeof props.maxLength === 'number' ? props.maxLength : null,
)
const currentLength = computed(() => countPlainText(inner.value))
const showCount = computed(() => props.showWordLimit && maxLengthValue.value !== null)
const isOverLimit = computed(
  () => maxLengthValue.value !== null && currentLength.value > maxLengthValue.value,
)
</script>

<template>
  <FormItem
    :label="label"
    :label-width="labelWidth"
    :label-hidden="labelHidden"
    :label-align="labelAlign"
    :label-icon-class="labelIconClass"
    :label-icon-position="labelIconPosition"
    :label-tooltip="labelTooltip"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="hintText"
    :column-width="columnWidth"
  >
    <div class="lc-rich-editor" :class="{ 'is-disabled': disabled }">
      <QuillEditor
        :content="inner"
        content-type="html"
        theme="snow"
        :toolbar="TOOLBAR"
        :placeholder="placeholder"
        :read-only="disabled"
        @update:content="handleUpdate"
      />
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
}
.lc-rich-editor.is-disabled {
  opacity: 0.7;
}
/* Quill 的容器默认白底 + 细边框由 snow 主题提供，这里只补圆角与内容最小高度 */
.lc-rich-editor :deep(.ql-container) {
  border-radius: 0 0 4px 4px;
  font-size: 13px;
}
/* 工具栏高度对齐参考实测：padding `8px 8px 4px`、行高 36px（Quill 默认是 padding 8px、
   行高 normal，量出来 42 vs 参考 50）。 */
.lc-rich-editor :deep(.ql-toolbar) {
  border-radius: 4px 4px 0 0;
  padding: 8px 8px 4px;
  line-height: 36px;
}
/*
 * `min-height: 200px` 对齐参考实测值：vue2-editor（参考）把 `.ql-editor` 的最小高
 * 设成了 200px，实测参考编辑区 201、整块 251；我们原来是 120，整块只有 163。
 */
.lc-rich-editor :deep(.ql-editor) {
  min-height: 200px;
  line-height: 22px;
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
