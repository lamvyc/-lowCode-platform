<script setup lang="ts">
import { computed } from 'vue'
import { ElRadio, ElRadioButton, ElRadioGroup } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcRadio' })

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
    /** 字段值（设计器里作为「默认值」，运行时为实时值）；未选中为 null */
    modelValue?: string | number | boolean | null
    /** 是否禁用 */
    disabled?: boolean
    /** 组件尺寸；'' 表示跟随全局默认尺寸 */
    size?: '' | 'large' | 'default' | 'small'
    /** 选项排列方式：同行内联 / 每项独占一行 */
    displayStyle?: 'inline' | 'block'
    /** 是否使用按钮样式（ElRadioButton） */
    buttonStyle?: boolean
    /** 是否带边框；⚠️ 仅对普通单选生效，按钮样式下 Element Plus 不支持（见下方说明） */
    border?: boolean
    /** 选项列表；初始选项由物料清单 defaultProps 提供，组件自身不设默认 */
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
    modelValue: null,
    disabled: false,
    size: '',
    displayStyle: 'inline',
    buttonStyle: false,
    border: false,
    optionItems: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean | null): void
  (e: 'change', value: string | number | boolean | null): void
}>()

/** Element Plus 不接受空字符串尺寸，'' 统一转为 undefined */
const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/** Element Plus 的空值是 undefined，本组件统一用 null 表示未选中 */
const radioValue = computed(() => props.modelValue ?? undefined)

/**
 * 选项排列方式：**无条件**把 `displayStyle` 的值绑到 CSS `display` 上。
 *
 * 参考实现就是 `:style="{display: field.options.displayStyle}"`
 * （variant-form `radio-widget.vue:11,16`）。
 *
 * ⚠️ 不要写成"只有 `block` 才设样式"——那样 `inline` 时元素会保持 Element 默认的
 * `inline-block`，与参考的 `inline` 在**折行行为与元素间距上并不等价**。
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
  >
    <ElRadioGroup
      :model-value="radioValue"
      :size="sizeProp"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event ?? null)"
      @change="emit('change', $event ?? null)"
    >
      <template v-for="(option, index) in optionItems" :key="`${option.value}-${index}`">
        <!--
          按钮样式分支：**不绑 border**。
          参考实现在 el-radio-button 上也绑了 :border，但 Element Plus 已移除该属性：
          RadioButtonProps extends RadioPropsBase，而 border 只声明在 RadioProps 上
          （已核对 element-plus 2.14.4 的 radio-button.d.ts / radio.d.ts）。
          绑上去只会作为 fallthrough attribute 落到根 DOM 上，因此这里有意省略。
        -->
        <ElRadioButton
          v-if="buttonStyle"
          :value="option.value"
          :disabled="option.disabled"
          :style="optionStyle"
        >
          {{ option.label }}
        </ElRadioButton>
        <ElRadio
          v-else
          :value="option.value"
          :disabled="option.disabled"
          :border="border"
          :style="optionStyle"
        >
          {{ option.label }}
        </ElRadio>
      </template>
    </ElRadioGroup>
  </FormItem>
</template>
