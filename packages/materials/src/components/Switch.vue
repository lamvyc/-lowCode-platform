<script setup lang="ts">
import { ElSwitch } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcSwitch' })

/** 开关值：布尔，或开启/关闭对应的字符串、数字 */
type SwitchValue = boolean | string | number

withDefaults(
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
  
    class="lc-switch">
    <div class="lc-switch__control">
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
    </div>
  </FormItem>
</template>

<style>
/*
 * ⚠️ 非 scoped：ElSwitch 不是本组件模板的根（根是 FormItem），
 * 类名落不到 `.el-switch` 上。用 `.lc-switch` 锚在 FormItem 根上。
 *
 * 实测参考的 `.el-switch` 高 **20px**，EP 默认是 32px（跟着 `--el-component-size`）——
 * 开关看起来明显大一号。
 */
.lc-switch .el-switch {
  height: 20px;
}

/* 开关只有 20px 高，但参考的控件区仍保持表单行高（实测 36px）——
   否则整行会比别的字段明显矮一截。
   ⚠️ 光撑高不够：控件区默认把子项顶对齐，20px 的开关会贴在最上面，
   比标签中线高 8px（参考实现里开关是垂直居中的）。这里显式居中。 */
.lc-switch .lc-switch__control {
  display: flex;
  align-items: center;
  min-height: 36px;
}
</style>
