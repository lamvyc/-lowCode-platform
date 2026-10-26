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
    /**
     * 远程搜索回调。
     *
     * **只有它存在时才会把 `remote-method` 绑给 ElSelect**——与参考实现的
     * `remoteMethod` computed 一致（variant-form `select-widget.vue:77-83`）。
     * 节点声明 `remoteQuery` 事件时，渲染器会以 `onRemoteQuery` 作为 prop 传入。
     * 若 `remote: true` 但没有这个回调，必须绑 `undefined`（而不是空函数），
     * 否则每次输入都会触发一次"空查询"。
     */
    onRemoteQuery?: (keyword: string) => void
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
    placeholder: '',
    options: () => [],
    optionItems: () => [],
    disabled: false,
    size: '',
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

/**
 * 「回车选中第一个匹配项」。
 *
 * 参考实现里它是从 `filterable && allowCreate` **推导**出来的，属性面板里没有独立开关
 * （variant-form `select-widget.vue:73-75`），所以这里同样用 computed，不新增 prop。
 */
const allowDefaultFirstOption = computed(() => props.filterable && props.allowCreate)

/** 占位文案：为空时回落到默认「请选择」（参考实现用 i18n('render.hint.selectPlaceholder')） */
const placeholderText = computed(() => props.placeholder || '请选择')

/** 远程搜索回调透传 */
function handleRemoteQuery(keyword: string) {
  props.onRemoteQuery?.(keyword)
}

/**
 * 远程搜索方法：**条件不满足时必须是 `undefined`**（不能是空函数）。
 * 参考实现 `select-widget.vue:77-83` 正是返回 `undefined`。
 */
const remoteMethod = computed(() =>
  props.remote && props.onRemoteQuery ? handleRemoteQuery : undefined,
)
</script>

<template>
  <FormItem
    class="lc-select"
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
      :placeholder="placeholderText"
      :size="sizeProp"
      :disabled="disabled"
      :clearable="clearable"
      :filterable="filterable"
      :allow-create="allowCreate"
      :default-first-option="allowDefaultFirstOption"
      :remote="remote"
      :remote-method="remoteMethod"
      :automatic-dropdown="automaticDropdownProp"
      :multiple="multiple"
      :multiple-limit="multipleLimit"
      style="width: 100%"
      @update:model-value="emit('update:modelValue', $event)"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
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

<style>
/*
 * ⚠️ 非 scoped：ElSelect 不是本组件模板的根（根是 FormItem），类名落不到
 * `.el-select` 上。用 `.lc-select` 锚在 FormItem 根上。
 *
 * 实测：控件区里 `--el-component-size` 已经是 36px（FormItem 设的），
 * 但 select 的 `.el-select__wrapper` 仍算出 `min-height: 32px` —— 它不走那个变量。
 * 于是下拉框比同排的单行输入矮 4px，一眼能看出来。
 */
.lc-select .el-select__wrapper {
  min-height: 36px;
}
</style>
