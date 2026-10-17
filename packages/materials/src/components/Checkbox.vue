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

/**
 * 选项排列方式：**无条件**把 `displayStyle` 的值绑到 CSS `display` 上。
 *
 * 参考实现就是 `:style="{display: field.options.displayStyle}"`
 * （variant-form `checkbox-widget.vue:11,16`）。
 *
 * ⚠️ 不要写成"只有 `block` 才设样式"：那样 `inline` 时会落到 Element Plus 的默认
 * `inline-flex`，而参考实现给的是 `inline` —— 两者在**间距与基线对齐**上不等价
 * （`inline-flex` 是原子内联盒，不参与父级行内排版）。
 *
 * 真机实测（element-plus 2.14.4，`.el-checkbox-group` 是 `display: block` 而非 flex，
 * 所以这里的 `display` 不会被块化）：
 *   修复前 inline → computed `inline-flex`（未设样式，落默认值）
 *   修复后 inline → computed `inline`      ✅
 */
const optionStyle = computed(() => ({ display: props.displayStyle }))
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
    class="lc-checkbox"
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

<style scoped>
/*
 * 与 Radio.vue 同一组对齐（原因见那边的注释）：EP 与 EU 的选项尺寸默认值不同。
 *
 *   .el-checkbox         EP 写死 height: var(--el-checkbox-height, 32px)；EU 是 auto
 *   .el-checkbox__inner  EU 是 content-box 14 + 2px 边框 = 16；EP 是 border-box 14
 *   .el-checkbox__label  padding-left：参考 10px / 我们 8px
 */
.lc-checkbox :deep(.el-checkbox) {
  height: auto;
  /* 与单选项一致：参考实测 36px（此前猜的 30px 是错的） */
  line-height: 36px;
}
/*
 * ⚠️ 这里**曾经**把 `__inner` 改成 16×16，那是错的（和 Radio.vue 同一个错误）。
 * 精确量盒模型后发现参考的方框就是 14×14 border-box，
 * 高度差来自 `__input` 的 display 与行高，不是方框大小。已撤销。
 */
.lc-checkbox :deep(.el-checkbox__input) {
  /* 参考是 inline-block（实测行高 14px）；EP 是 inline-flex，行高继承到 36px */
  display: inline-block;
  line-height: 1;
  /* 参考是 vertical-align: middle；baseline 会让行盒被 inline-block 撑高
     （多选项的 group 高实测 41 vs 36，那 5px 就是它）。 */
  vertical-align: middle;
}
.lc-checkbox :deep(.el-checkbox__label) {
  padding-left: 10px;
  /* 参考的标签是 inline-block 且行高 19px（实测）；我们继承到 14px，整行矮 5px */
  line-height: 19px;
}
</style>
