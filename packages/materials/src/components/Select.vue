<script setup lang="ts">
import { computed } from 'vue'
import { ElOption, ElSelect } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcSelect' })

/** 下拉选项（仅本文件内使用，不作导出） */
interface SelectOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
}

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值）；多选时为数组 */
    modelValue?: string | number | boolean | Array<string | number | boolean>
    /** 占位提示 */
    placeholder?: string
    /** 选项列表（兼容旧 schema 的别名，optionItems 优先） */
    options?: SelectOption[]
    /** 选项列表 */
    optionItems?: SelectOption[]
    /** 是否禁用 */
    disabled?: boolean
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否可清空 */
    clearable?: boolean
    /** 是否可搜索 */
    filterable?: boolean
    /** 是否允许创建新选项（需配合 filterable） */
    allowCreate?: boolean
    /** 是否远程搜索；开启后搜索输入会 emit remoteQuery */
    remote?: boolean
    /** 是否在聚焦时自动展开下拉（仅在多选或不可搜索时生效） */
    automaticDropdown?: boolean
    /** 是否多选 */
    multiple?: boolean
    /** 多选时最多可选数量，0 表示不限制 */
    multipleLimit?: number
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
    placeholder: '请选择',
    options: () => [],
    optionItems: () => [],
    disabled: false,
    size: 'default',
    clearable: true,
    filterable: false,
    allowCreate: false,
    remote: false,
    automaticDropdown: false,
    multiple: false,
    multipleLimit: 0,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean | Array<string | number | boolean>): void
  (e: 'change', value: string | number | boolean | Array<string | number | boolean>): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'clear'): void
  (e: 'remoteQuery', keyword: string): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 选项列表：optionItems 优先，兼容旧的 options；容错非数组配置 */
const mergedOptions = computed<SelectOption[]>(() => {
  if (Array.isArray(props.optionItems) && props.optionItems.length > 0) return props.optionItems
  return Array.isArray(props.options) ? props.options : []
})

/** Element Plus 仅在「多选」或「不可搜索」时支持自动展开下拉 */
const automaticDropdownProp = computed(
  () => props.automaticDropdown && (props.multiple || !props.filterable),
)

/** 远程搜索：把 Element Plus 的 remote-method 回调转成 remoteQuery 事件 */
function handleRemoteQuery(keyword: string) {
  emit('remoteQuery', keyword)
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
    <ElSelect
      :model-value="modelValue"
      :placeholder="placeholder"
      :size="sizeProp"
      :disabled="disabled"
      :clearable="clearable"
      :filterable="filterable"
      :allow-create="allowCreate"
      :remote="remote"
      :remote-method="handleRemoteQuery"
      :automatic-dropdown="automaticDropdownProp"
      :multiple="multiple"
      :multiple-limit="multipleLimit"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
      @clear="emit('clear')"
    >
      <ElOption
        v-for="option in mergedOptions"
        :key="`${option.value}`"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </ElSelect>
  </FormItem>
</template>
