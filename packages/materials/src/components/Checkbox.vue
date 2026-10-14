<script setup lang="ts">
import { computed } from 'vue'
import { ElCheckbox, ElCheckboxButton, ElCheckboxGroup } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcCheckbox' })

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值）；多选，未选中为 [] */
    modelValue?: Array<string | number | boolean>
    /** 是否禁用 */
    disabled?: boolean
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 选项排列方式：同行内联 / 每项独占一行 */
    displayStyle?: 'inline' | 'block'
    /** 是否使用按钮样式（ElCheckboxButton） */
    buttonStyle?: boolean
    /** 是否带边框 */
    border?: boolean
    /** 选项列表 */
    optionItems?: Array<{ label: string; value: string | number | boolean; disabled?: boolean }>
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
    modelValue: () => [],
    disabled: false,
    size: 'default',
    displayStyle: 'inline',
    buttonStyle: false,
    border: false,
    optionItems: () => [
      { label: 'checkbox 1', value: 1 },
      { label: 'checkbox 2', value: 2 },
      { label: 'checkbox 3', value: 3 },
    ],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Array<string | number | boolean>): void
  (e: 'change', value: Array<string | number | boolean>): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** Element Plus 的 CheckboxGroup 值类型为 (string | number)[]，这里做一次类型收敛 */
const checkboxValue = computed(() => props.modelValue as Array<string | number>)

/** 块状排列时每个选项独占一行 */
const optionStyle = computed(() => (props.displayStyle === 'block' ? 'display: block' : undefined))
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
    <ElCheckboxGroup
      :model-value="checkboxValue"
      :size="sizeProp"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
    >
      <template v-for="(option, index) in optionItems" :key="`${option.value}-${index}`">
        <ElCheckboxButton
          v-if="buttonStyle"
          :value="option.value"
          :disabled="option.disabled"
          :border="border"
          :style="optionStyle"
        >
          {{ option.label }}
        </ElCheckboxButton>
        <ElCheckbox
          v-else
          :value="option.value"
          :disabled="option.disabled"
          :border="border"
          :style="optionStyle"
        >
          {{ option.label }}
        </ElCheckbox>
      </template>
    </ElCheckboxGroup>
  </FormItem>
</template>
