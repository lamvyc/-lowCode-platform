<script setup lang="ts">
import { computed } from 'vue'
import { ElColorPicker } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcColor' })

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
    :label-icon-class="labelIconClass"
    :label-icon-position="labelIconPosition"
    :label-tooltip="labelTooltip"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="validationHint"
    :column-width="columnWidth"
  
    class="lc-color">
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

<style scoped>
/*
 * EP 的颜色选择器触发器默认 32×32（`--el-component-size`），参考（EU 的 medium 档）是 36×36。
 * 内部尺寸是跟着触发器缩放的，所以改一处能连带修好 4 层：
 *
 *   触发器 32 → 36、色块 22 → 26、颜色区 20 → 24
 *
 * 实测参考：el-color-picker__trigger 36、__color 26、__color-inner 24。
 */
.lc-color :deep(.el-color-picker),
.lc-color :deep(.el-color-picker__trigger) {
  width: 36px;
  height: 36px;
}
</style>
