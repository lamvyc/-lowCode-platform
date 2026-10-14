<script setup lang="ts">
import { computed } from 'vue'
import { ElInputNumber } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcNumber' })

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
    /** 是否必填（仅用于展示必填标记） */
    required?: boolean
    /** 必填提示文案 */
    requiredHint?: string
    /** 校验提示文案 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 字段值（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: number
    /** 占位提示 */
    placeholder?: string
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否禁用 */
    disabled?: boolean
    /** 允许的最小值 */
    min?: number
    /** 允许的最大值 */
    max?: number
    /** 数值精度（小数位数），0 表示只能输入整数 */
    precision?: number
    /** 每次增减的步长 */
    step?: number
    /** 增减按钮位置；Element Plus 仅支持 '' | 'right'，'left' 会回落为默认（右侧） */
    controlsPosition?: 'right' | 'left' | ''
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
    modelValue: 0,
    placeholder: '',
    size: 'default',
    disabled: false,
    min: -100000000000,
    max: 100000000000,
    precision: 0,
    step: 1,
    controlsPosition: 'right',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
  (e: 'change', value: number | undefined): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** Element Plus 的 controls-position 只声明了 '' | 'right'，这里原样透传（'left' 由其内部回落为默认） */
const controlsPositionProp = computed(
  () => (props.controlsPosition === '' ? undefined : props.controlsPosition) as 'right' | undefined,
)
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
    <ElInputNumber
      :model-value="modelValue"
      :placeholder="placeholder"
      :size="sizeProp"
      :disabled="disabled"
      :min="min"
      :max="max"
      :precision="precision"
      :step="step"
      :controls-position="controlsPositionProp"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>
