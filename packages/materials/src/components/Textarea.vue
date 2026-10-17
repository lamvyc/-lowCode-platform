<script setup lang="ts">
import { computed } from 'vue'
import { ElInput } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcTextarea' })

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
    /** 标签图标 class（如 el-icon-user） */
    labelIconClass?: string
    /** 标签图标位置：前置 / 后置 */
    labelIconPosition?: 'front' | 'rear'
    /** 标签悬浮提示 */
    labelTooltip?: string
    /** 是否必填（仅用于展示必填标记） */
    required?: boolean
    /** 必填提示文案 */
    requiredHint?: string
    /** 校验提示文案 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 字段值（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: string
    /** 占位提示 */
    placeholder?: string
    /** 文本域行数 */
    rows?: number
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否禁用 */
    disabled?: boolean
    /** 是否只读 */
    readonly?: boolean
    /** 最少输入字符数 */
    minLength?: number | null
    /** 最多输入字符数 */
    maxLength?: number | null
    /** 是否显示字数统计（仅在设置了 maxLength 时生效） */
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
    modelValue: '',
    placeholder: '请输入',
    rows: 3,
    size: 'default',
    disabled: false,
    readonly: false,
    minLength: null,
    maxLength: null,
    showWordLimit: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'change', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** maxlength / minlength 仅在大于 0 时传给 Element Plus */
const maxLength = computed(() => (props.maxLength && props.maxLength > 0 ? props.maxLength : undefined))
const minLength = computed(() => (props.minLength && props.minLength > 0 ? props.minLength : undefined))
</script>

<template>
  <FormItem
    class="lc-textarea"
    :label="label"
    :label-width="labelWidth"
    :label-hidden="labelHidden"
    :label-align="labelAlign"
    :label-icon-class="labelIconClass"
    :label-icon-position="labelIconPosition"
    :label-tooltip="labelTooltip"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="validationHint"
    :column-width="columnWidth"
  >
    <ElInput
      type="textarea"
      :model-value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :size="sizeProp"
      :disabled="disabled"
      :readonly="readonly"
      :minlength="minLength"
      :maxlength="maxLength"
      :show-word-limit="showWordLimit && Boolean(maxLength)"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', $event)"
      @input="emit('input', $event)"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>

<style>
/*
 * ⚠️ 非 scoped：ElInput 不是本组件模板的根（根是 FormItem），
 * 它落在插槽里、拿不到 scope 属性（同 TabPane / ElUpload 那一类问题）。
 * 用 `.lc-textarea` 这个落在 FormItem 根上的类名做锚点。
 *
 * 实测参考 `el-textarea__inner` 的 padding 是 `5px 15px`，我们是 `5px 11px`
 * —— 文字离左右边框近了 4px，这个在视觉上是能看出来的。
 */
.lc-textarea .el-textarea__inner {
  padding: 5px 15px;
}
</style>
