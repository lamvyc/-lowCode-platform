<script setup lang="ts">
import { computed } from 'vue'
import { ElSlider } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcSlider' })

/** 滑块值：单滑块为数字，range 打开时为数字数组 */
type SliderValue = number | number[]

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值），range 打开时为数组 */
    modelValue?: SliderValue
    /** 是否禁用（通常由父级运行时控制） */
    disabled?: boolean
    /** 最小值 */
    min?: number
    /** 最大值 */
    max?: number
    /** 步长 */
    step?: number
    /** 是否开启双滑块区间选择 */
    range?: boolean
    /** 是否显示间断点 */
    showStops?: boolean
    /** 是否竖向模式 */
    vertical?: boolean
    /** 竖向模式下的高度（px），仅 vertical 时生效 */
    height?: number | null
    /** 控件尺寸；'' 表示不传、交给 Element Plus 默认值 */
    size?: '' | 'large' | 'default' | 'small'
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
    disabled: false,
    min: 0,
    max: 100,
    step: 10,
    range: false,
    showStops: false,
    vertical: false,
    height: null,
    size: 'default',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SliderValue): void
  (e: 'change', value: SliderValue): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 仅竖向模式传高度；height 为 px 数值，转成 Element Plus 需要的字符串 */
const heightProp = computed(() =>
  props.vertical && props.height !== null ? `${props.height}px` : undefined,
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
    <ElSlider
      class="lc-slider"
      :model-value="modelValue"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      :range="range"
      :show-stops="showStops"
      :vertical="vertical"
      :height="heightProp"
      :size="sizeProp"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />
  </FormItem>
</template>

<style scoped>
.lc-slider {
  width: 100%;
}
</style>
