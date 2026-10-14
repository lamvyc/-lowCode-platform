<script setup lang="ts">
import { computed } from 'vue'
import { ElColorPicker } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcColor' })

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值），形如 '#409eff' */
    modelValue?: string | null
    /** 是否禁用 */
    disabled?: boolean
    /** 控件尺寸；'' 表示不传、交给 Element Plus 默认值 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否支持透明度选择 */
    showAlpha?: boolean
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
    disabled: false,
    size: 'default',
    showAlpha: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 清空颜色时 Element Plus 回传 null，统一转成空字符串 */
function normalizeColor(value: string | null): string {
  return value ?? ''
}

function handleUpdate(value: string | null) {
  emit('update:modelValue', normalizeColor(value))
}

function handleChange(value: string | null) {
  emit('change', normalizeColor(value))
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
    <ElColorPicker
      :model-value="modelValue"
      :disabled="disabled"
      :size="sizeProp"
      :show-alpha="showAlpha"
      @update:model-value="handleUpdate"
      @change="handleChange"
    />
  </FormItem>
</template>
