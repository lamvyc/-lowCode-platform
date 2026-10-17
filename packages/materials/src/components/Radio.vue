<script setup lang="ts">
import { computed } from 'vue'
import { ElRadio, ElRadioButton, ElRadioGroup } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcRadio' })

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
    class="lc-radio"
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

<style scoped>
/*
 * ⚠️ 恢复参考实现的**容器语义**，否则 `displayStyle` 会静默失效。
 *
 * 参考实现（Element UI 2.x）里 `.el-radio-group` 是 `display: inline-block`，
 * 所以 `:style="{display: displayStyle}"` 绑在选项上能真正生效。
 * Element Plus 把容器改成了 `display: inline-flex` —— 选项一旦成为 flex item，
 * 其 `display` 会按 CSS 规范被「块化」（`inline` → `block`），于是：
 *   `displayStyle: 'block'` 时各选项**仍旧挤在同一行**，属性面板改了没有任何效果。
 *
 * 真实 Chrome 实测（element-plus 2.14.4，见 scripts/cdp-inspect.mjs）：
 *   容器 inline-flex  + displayStyle=block → 3 个选项同行      ❌
 *   容器 inline-block + displayStyle=block → 3 行（宽度按内容收缩）✅
 *   容器 inline-block + displayStyle=inline → 1 行              ✅
 * 取 `inline-block` 是因为它与 Element UI 的容器取值一致，收缩行为也对得上；
 * 用 `block` 会让选项撑满整行（784px），与参考不一致。
 */
.lc-radio :deep(.el-radio-group) {
  display: inline-block;
}

/*
 * 以下三条对齐参考（Element UI）的实测值。EP 与 EU 在这些尺寸上的默认值不同，
 * 叠起来就是"选项比参考高 3px、圆点小 2px、文字离得更近"。
 *
 *   .el-radio         EP 写死 height: 32px；EU 是 auto（内容 17px）→ 实测参考 17 / 我们 20
 *   .el-radio__inner  EU 是 content-box 14 + 2px 边框 = 16；EP 是 border-box 14
 *                     → 实测参考 __input 高 16 / 我们 14
 *   .el-radio__label  padding-left：参考 10px / 我们 8px
 */
.lc-radio :deep(.el-radio) {
  height: auto;
  /* 参考自己的 global.scss 里有
     `.el-form-item--medium .el-radio { line-height: 36px !important }`，
     它撑起了整行（实测参考 group 高 36、选项高 17；我们是 20 / 20）。
     ⚠️ 这条是**参考的业务样式**，不是 Element 的默认值——只读库的 CSS 找不到。 */
  line-height: 36px;
}
/*
 * ⚠️ 这里**曾经**把 `__inner` 改成 16×16，那是错的。
 * 精确量两边的盒模型后发现：参考的圆点就是 **14×14 border-box**，
 * 3px 的选项高差不是圆点大小造成的，而是 `__input` 的 **行高**
 * （参考 14px / 我们继承到 36px）。
 * 已撤销 16px 覆盖，改为对齐 `__input` 的 display 与 line-height。
 */
.lc-radio :deep(.el-radio__input) {
  /* 参考是 inline-block + line-height:1（实测 14px）；EP 是 inline-flex，
     行高继承到 36px，把选项整体顶高了 3px（20 vs 17）。 */
  display: inline-block;
  line-height: 1;
  /* 参考是 vertical-align: middle；baseline 会让行盒被 inline-block 撑高
     （多选项的 group 高实测 41 vs 36，那 5px 就是它）。 */
  vertical-align: middle;
}
.lc-radio :deep(.el-radio__label) {
  padding-left: 10px;
}
</style>
