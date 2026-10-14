<script setup lang="ts">
import { computed } from 'vue'
import { ElTimePicker } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcTimeRange' })

/** 时间区间选择器承载的值：单值或区间数组 */
type TimeRangeValue = string | Date | string[] | Date[] | null

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
    /** 是否必填（仅展示必填标记） */
    required?: boolean
    /** 必填提示文案 */
    requiredHint?: string
    /** 校验提示文案 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 字段值（设计器里作为「默认值」，运行时为实时值），区间为数组 */
    modelValue?: TimeRangeValue
    /** 开始时间占位提示 */
    startPlaceholder?: string
    /** 结束时间占位提示 */
    endPlaceholder?: string
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
    /** 时间展示格式，如 'HH:mm:ss' */
    format?: string
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
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    size: 'default',
    disabled: false,
    readonly: false,
    clearable: true,
    editable: false,
    format: 'HH:mm:ss',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: TimeRangeValue): void
  (e: 'change', value: TimeRangeValue): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 把 Element Plus 的回调值收敛为本组件声明的值类型 */
function normalizeTimeRange(value: unknown): TimeRangeValue {
  if (value === undefined || value === null || value === '') return null
  return value as TimeRangeValue
}

function handleUpdate(value: unknown) {
  emit('update:modelValue', normalizeTimeRange(value))
}

function handleChange(value: unknown) {
  emit('change', normalizeTimeRange(value))
}
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
    :validation-hint="validationHint"
    :column-width="columnWidth"
  >
    <ElTimePicker
      class="lc-time-range"
      is-range
      :model-value="modelValue"
      :start-placeholder="startPlaceholder"
      :end-placeholder="endPlaceholder"
      range-separator="-"
      :size="sizeProp"
      :disabled="disabled"
      :readonly="readonly"
      :clearable="clearable"
      :editable="editable"
      :format="format"
      @update:model-value="handleUpdate"
      @change="handleChange"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>

<style scoped>
.lc-time-range {
  width: 100%;
}
</style>
