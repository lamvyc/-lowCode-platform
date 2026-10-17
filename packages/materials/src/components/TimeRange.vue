<script setup lang="ts">
import { computed } from 'vue'
import { ElTimePicker } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcTimeRange' })

/** 时间区间选择器承载的值：单值或区间数组 */
type TimeRangeValue = string | Date | string[] | Date[] | null

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
    /** 是否必填（仅展示必填标记） */
    required?: boolean
    /** 必填提示文案 */
    requiredHint?: string
    /** 校验提示文案 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 字段值（设计器里作为「默认值」，运行时为实时值），区间为数组 */
    modelValue?: TimeRangeValue
    /** 开始时间占位提示 */
    startPlaceholder?: string
    /** 结束时间占位提示 */
    endPlaceholder?: string
    /** 控件尺寸；'' 表示不传、交给 Element Plus 默认值 */
    size?: '' | 'large' | 'default' | 'small'
    /** 是否禁用 */
    disabled?: boolean
    /** 是否只读 */
    readonly?: boolean
    /** 是否可清空 */
    clearable?: boolean
    /** 是否允许在输入框内直接输入 */
    editable?: boolean
    /** 时间展示格式，如 'HH:mm:ss' */
    format?: string
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
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    size: 'default',
    disabled: false,
    readonly: false,
    clearable: true,
    editable: false,
    format: 'HH:mm:ss',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: TimeRangeValue): void
  (e: 'change', value: TimeRangeValue): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** 把 Element Plus 的回调值收敛为本组件声明的值类型 */
function normalizeTimeRange(value: unknown): TimeRangeValue {
  if (value === undefined || value === null || value === '') return null
  return value as TimeRangeValue
}

function handleUpdate(value: unknown) {
  emit('update:modelValue', normalizeTimeRange(value))
}

function handleChange(value: unknown) {
  emit('change', normalizeTimeRange(value))
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
    <ElTimePicker
      style="--el-date-editor-width: 100%; width: 100%; box-sizing: border-box"
      class="lc-time-range"
      is-range
      :model-value="modelValue"
      :start-placeholder="startPlaceholder"
      :end-placeholder="endPlaceholder"
      range-separator="-"
      :size="sizeProp"
      :disabled="disabled"
      :readonly="readonly"
      :clearable="clearable"
      :editable="editable"
      :format="format"
      @update:model-value="handleUpdate"
      @change="handleChange"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
  </FormItem>
</template>

<style scoped>
  /*
   * ⚠️ 这里**不能**靠 scoped 样式改宽度 —— 原因有两层：
   *
   * ① 元素上没有 scope 属性：ElTimePicker / ElDatePicker 不是本组件模板的根
   *    （根是 FormItem），它们落在 FormItem 的插槽里，Vue 不给它们加 data-v-*。
   *    实测该元素属性只有 ["class","tabindex"]，`matches('.lc-time-range[data-v-x]')` 为 false
   *    —— 所以 scoped 规则**从未匹配过**。
   *    （Divider.vue 能用 scoped，是因为 ElDivider 是它模板的根。）
   *
   * ② 宽度是变量驱动的，直接写 width 会和 EP 打成平手：
   *      .el-date-editor.el-input__wrapper { width: var(--el-date-editor-width) }  (0,2,0)
   *      .el-date-editor--timerange { --el-date-editor-width: 350px }              (0,1,0)
   *    同为 (0,2,0) 时靠源码顺序决胜负，我们输（实测 computed width 仍是 350px）。
   *
   * 因此宽度改用**内联样式**给在模板上（见 style 属性）：权重最高、且组件局部。
   * box-sizing 也要一起给 border-box：EP 的 `.el-input__wrapper` 是 content-box，
   * width:100% 之外还会再加上 padding 10px×2，实测 924 的容器里量出 944（溢出 20px）。
   * 参考实现（Element UI）的 .el-range-editor 没有固定宽度，本来就是撑满的。
   */
</style>

<style>
/*
 * ⚠️ 这个块**故意不加 scoped**：上面 <style scoped> 的注释说明了原因——
 * ElTimePicker / ElDatePicker 及其内部元素上都没有 scope 属性，
 * scoped 规则（`.lc-xxx[data-v-x] .el-yyy`）永远匹配不到。
 * 因此用我们自己的类名 `.lc-time-range` 限定作用域，写成全局规则。
 *
 * 三条都是对齐参考实现（Element UI）的实测值：
 *
 * 1) .el-range-separator —— EP 加了 flex:1，分隔符撑满剩余空间（实测 171px），
 *    参考只有 55px（收缩到内容宽）。这是我们侧最显眼的一处偏差。
 * 2) .el-range-input —— EP 写死 height/line-height: 30px，参考（medium）是 28px。
 * 3) .el-range-editor 的竖向内边距 —— 参考是 3px，EP 是 0。
 */
.lc-time-range.el-range-editor {
  padding: 3px 10px;
}
.lc-time-range .el-range-separator {
  /* 参考：`.el-date-editor .el-range-separator { width: 5% }` —— 5% × 904 = 45.2px，
     正是参考实测的那个"对 '-' 来说不合理"的内容宽 45.09px。
     EP 去掉了 width、改成 flex:1，于是分隔符撑满剩余空间（实测 171px，参考 55px）。 */
  flex: none;
  width: 5%;
  /* 参考是 display: inline-block（作为 flex item 会被块化成 block）；EP 是 inline-flex */
  display: inline-block;
  line-height: 28px;
  height: 28px;   /* 参考（medium）是 28px；EP 的 height:100% 会跟着编辑器内容高变成 30px */
}
.lc-time-range .el-range-input {
  height: 28px;
  line-height: 28px;
}
</style>
