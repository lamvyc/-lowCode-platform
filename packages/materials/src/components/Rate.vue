<script setup lang="ts">
import { ElRate } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcRate' })

withDefaults(
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
    modelValue?: number | null
    /** 是否禁用 */
    disabled?: boolean
    /** 最大分值（星星数量） */
    max?: number
    /** 低分与中分的分界值，低于该值显示低分颜色 */
    lowThreshold?: number
    /** 中分与高分的分界值，达到该值显示高分颜色 */
    highThreshold?: number
    /** 是否允许半星 */
    allowHalf?: boolean
    /** 是否显示辅助文字 */
    showText?: boolean
    /** 是否显示当前分数 */
    showScore?: boolean
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
    max: 5,
    lowThreshold: 2,
    highThreshold: 4,
    allowHalf: false,
    showText: false,
    showScore: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()
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
    <ElRate
      class="lc-rate"
      :model-value="modelValue ?? 0"
      :disabled="disabled"
      :max="max"
      :low-threshold="lowThreshold"
      :high-threshold="highThreshold"
      :allow-half="allowHalf"
      :show-text="showText"
      :show-score="showScore"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />
  </FormItem>
</template>

<style scoped>
.lc-rate {
  width: 100%;
}
</style>
