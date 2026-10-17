<script setup lang="ts">
import { computed } from 'vue'
import { ElInputNumber } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcNumber' })

const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
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
    :label-icon-class="labelIconClass"
    :label-icon-position="labelIconPosition"
    :label-tooltip="labelTooltip"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="validationHint"
    :column-width="columnWidth"
  
    class="lc-number">
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

<style scoped>
/*
 * 计数器的 +/− 按钮：参考（EU）宽 37、高 17、字号 14；EP 宽 33、高 15、字号 13。
 * EP 的默认宽度是写死的 32px，字号 13px —— 高度是跟着字号走的，所以改字号能同时修高度。
 */
.lc-number :deep(.el-input-number__increase),
.lc-number :deep(.el-input-number__decrease) {
  width: 36px;
  font-size: 14px;
  /* 高度既不吃 font-size 也不吃 line-height（EP 把这两个按钮做成了
     `display: flex` 的绝对定位元素，高度由内容盒撑开），只能显式给。
     实测参考 __decrease 17px / __increase 18px（差 1px 来自边框）。 */
  height: 17px;
  line-height: 17px;
}
</style>
