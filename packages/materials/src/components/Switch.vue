<script setup lang="ts">
import { ElSwitch } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcSwitch' })

/** 开关值：布尔，或开启/关闭对应的字符串、数字 */
type SwitchValue = boolean | string | number

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: SwitchValue
    /** 是否禁用 */
    disabled?: boolean
    /** 开关宽度（px） */
    switchWidth?: number
    /** 打开时的文字描述 */
    activeText?: string
    /** 关闭时的文字描述 */
    inactiveText?: string
    /** 打开时的背景色；为空时不传 */
    activeColor?: string
    /** 关闭时的背景色；为空时不传 */
    inactiveColor?: string
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
    modelValue: false,
    disabled: false,
    switchWidth: 40,
    activeText: '',
    inactiveText: '',
    activeColor: '',
    inactiveColor: '',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SwitchValue): void
  (e: 'change', value: SwitchValue): void
}>()
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
    <ElSwitch
      :model-value="modelValue"
      :disabled="disabled"
      :width="switchWidth"
      :active-text="activeText"
      :inactive-text="inactiveText"
      :active-color="activeColor || undefined"
      :inactive-color="inactiveColor || undefined"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    />
  </FormItem>
</template>
