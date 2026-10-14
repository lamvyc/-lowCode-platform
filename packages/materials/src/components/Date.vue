<script setup lang="ts">
import { computed } from 'vue'
import { ElDatePicker } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcDate' })

/** 日期选择器承载的值：格式化后的字符串或 Date */
type DateValue = string | Date | null

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
    /** 是否必填（仅展示必填标记） */
    required?: boolean
    /** 必填提示文案 */
    requiredHint?: string
    /** 校验提示文案 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 字段值（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: DateValue
    /** 选择器类型：日期 / 日期时间 / 月 / 年 */
    type?: 'date' | 'datetime' | 'month' | 'year'
    /** 未选择时的占位提示 */
    placeholder?: string
    /** 控件尺寸；'' 表示不传、交给 Element Plus 默认值 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否禁用 */
    disabled?: boolean
    /** 是否只读 */
    readonly?: boolean
    /** 是否可清空 */
    clearable?: boolean
    /** 是否允许在输入框内直接输入 */
    editable?: boolean
    /** 输入框展示格式 */
    format?: string
    /** 绑定值的格式；为空时绑定 Date 对象 */
    valueFormat?: string
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
    modelValue: null,
    type: 'date',
    placeholder: '请选择日期',
    size: 'default',
    disabled: false,
    readonly: false,
    clearable: true,
    editable: false,
    format: 'YYYY-MM-DD',
    valueFormat: 'YYYY-MM-DD',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: DateValue): void
  (e: 'change', value: DateValue): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 把 Element Plus 的回调值收敛为本组件声明的值类型 */
function normalizeDate(value: unknown): DateValue {
  if (value === undefined || value === null || value === '') return null
  return value as DateValue
}

function handleUpdate(value: unknown) {
  emit('update:modelValue', normalizeDate(value))
}

function handleChange(value: unknown) {
  emit('change', normalizeDate(value))
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
    :validation-hint="validationHint"
    :column-width="columnWidth"
  >
    <ElDatePicker
      class="lc-date-picker"
      :model-value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :size="sizeProp"
      :disabled="disabled"
      :readonly="readonly"
      :clearable="clearable"
      :editable="editable"
      :format="format"
      :value-format="valueFormat || undefined"
      @update:model-value="handleUpdate"
      @change="handleChange"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>

<style scoped>
.lc-date-picker {
  width: 100%;
}
</style>
