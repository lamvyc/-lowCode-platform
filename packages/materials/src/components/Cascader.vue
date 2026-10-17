<script setup lang="ts">
import { computed } from 'vue'
import { ElCascader } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcCascader' })

/** 级联选项（仅本文件内使用，不作导出）；用 type 而非 interface，便于兼容 Element Plus 的索引签名 */
type CascaderOption = {
  label: string
  value: string | number
  children?: CascaderOption[]
  disabled?: boolean
}

/** 字段值：单选为单值，多选 / 父子不互相关联时为路径数组 */
type CascaderModelValue = string | number | Array<string | number> | null

const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
    onValidate?: string
    onMounted?: string
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
    /** 字段值（设计器里作为「默认值」，运行时为实时值）；未选中为 null */
    modelValue?: CascaderModelValue
    /** 占位提示 */
    placeholder?: string
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否禁用 */
    disabled?: boolean
    /** 是否可清空 */
    clearable?: boolean
    /** 是否可搜索 */
    filterable?: boolean
    /** 是否多选 */
    multiple?: boolean
    /** 是否允许选择任意一级（父子节点不互相关联） */
    checkStrictly?: boolean
    /** 是否显示完整路径 */
    showAllLevels?: boolean
    /** 选项列表（递归结构，children 为子级） */
    optionItems?: CascaderOption[]
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
    placeholder: '请选择',
    size: 'default',
    disabled: false,
    clearable: true,
    filterable: false,
    multiple: false,
    checkStrictly: false,
    showAllLevels: true,
    optionItems: () => [
      { label: 'select 1', value: 1, children: [{ label: 'child 1', value: 11 }] },
      { label: 'select 2', value: 2 },
      { label: 'select 3', value: 3 },
    ],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: CascaderModelValue): void
  (e: 'change', value: CascaderModelValue): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** Element Plus 的级联值类型更宽（还包含对象与嵌套数组），这里收敛成本组件的值类型 */
function toModelValue(value: unknown): CascaderModelValue {
  return (value ?? null) as CascaderModelValue
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
    <ElCascader
      :model-value="modelValue"
      :options="optionItems"
      :props="{ multiple, checkStrictly, expandTrigger: 'hover' }"
      :placeholder="placeholder"
      :size="sizeProp"
      :disabled="disabled"
      :clearable="clearable"
      :filterable="filterable"
      :show-all-levels="showAllLevels"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', toModelValue($event))"
      @change="emit('change', toModelValue($event))"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>
