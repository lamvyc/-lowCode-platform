<script setup lang="ts">
import { computed } from 'vue'
import { ElTooltip } from 'element-plus'
import { getFormSettings } from '@lowcode/schema'
import { useRuntimeContext } from '../use-runtime'
import { useFieldContext } from '../use-field'

/**
 * 表单字段外壳：统一「标签 + 必填标记 + 校验错误」布局。
 * 标签位置/对齐/宽度来自「表单设置」（settings.form），面板改动即时反映到画布与运行时。
 *
 * 校验错误来自运行时上下文（按 nodeId 存），由渲染器在字段的 blur/change 后写入；
 * 设计态渲染器不触发校验，所以画布上不会出现错误提示。
 *
 * 注意：`requiredHint` / `validationHint` 是**校验失败时的错误文案**（对应参考实现的
 * `required` 规则 message 与校验器 errorMsg），不是常显的说明文字，因此这里不直接渲染它们。
 */
const props = withDefaults(
  defineProps<{
    label?: string
    /** 标签宽度（px）；为空时按内容自适应 */
    labelWidth?: number | null
    labelHidden?: boolean
    labelAlign?: 'left' | 'center' | 'right'
    /** 标签图标 class（如 el-icon-user） */
    labelIconClass?: string
    /** 标签图标位置 */
    labelIconPosition?: 'front' | 'rear'
    /** 标签悬浮提示 */
    labelTooltip?: string
    required?: boolean
    requiredHint?: string
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
  }>(),
  {
    label: '',
    labelWidth: null,
    labelHidden: false,
    labelAlign: 'left',
    labelIconClass: '',
    labelIconPosition: 'rear',
    labelTooltip: '',
    required: false,
    requiredHint: '',
    validationHint: '',
    columnWidth: '',
  },
)

const runtime = useRuntimeContext()
const field = useFieldContext()

/** 当前字段的校验错误（无字段上下文时为 undefined，例如单独挂载物料） */
const error = computed(() =>
  field ? runtime.value?.getFieldError(field.nodeId) : undefined,
)

/** 表单级排版设置（无运行时上下文时回落默认值） */
const formSettings = computed(() => getFormSettings(runtime.value?.schema?.settings))

const labelPosition = computed(() => formSettings.value.labelPosition ?? 'top')
const effectiveLabelWidth = computed(
  () => props.labelWidth ?? formSettings.value.labelWidth ?? null,
)
const effectiveLabelAlign = computed(() => props.labelAlign || formSettings.value.labelAlign || 'left')

const showLabel = computed(() => !props.labelHidden && props.label !== '')

const labelStyle = computed(() => {
  if (labelPosition.value === 'top') return undefined
  return {
    width: effectiveLabelWidth.value ? `${effectiveLabelWidth.value}px` : undefined,
    textAlign: effectiveLabelAlign.value,
  }
})

const controlStyle = computed(() => ({
  width: props.columnWidth || undefined,
}))
</script>

<template>
  <div class="lc-form-item" :class="`lc-form-item--${labelPosition}`">
    <label v-if="showLabel" class="lc-form-item__label" :style="labelStyle">
      <i
        v-if="labelIconClass && labelIconPosition === 'front'"
        :class="labelIconClass"
        class="lc-form-item__icon"
      />
      <span v-if="required" class="lc-form-item__required">*</span>{{ label }}
      <i
        v-if="labelIconClass && labelIconPosition === 'rear'"
        :class="labelIconClass"
        class="lc-form-item__icon"
      />
      <ElTooltip v-if="labelTooltip" effect="light" placement="top" :content="labelTooltip">
        <i class="lc-form-item__help">?</i>
      </ElTooltip>
    </label>
    <div class="lc-form-item__control" :style="controlStyle">
      <slot />
      <p v-if="error" class="lc-form-item__error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
/**
 * ⚠️ 这里的尺寸/间距/字号是对齐参考实现实测值的，不是随手定的。
 * 参考（Element UI `.el-form-item` + medium 尺寸）实测：
 *   条目 margin-bottom 22px；label 高 36px、行高 36px、字号 14px、
 *   padding-right 12px、颜色 rgb(96,98,102)；控件高 36px。
 * 对齐前我们分别是 0 / 32px / 13px / 8px / #4e5969 / 32px——
 * 单看每一项都不起眼，叠起来就是"整体感觉不一样"。
 */
.lc-form-item {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 22px;
}
.lc-form-item--left {
  flex-direction: row;
  align-items: flex-start;
}
.lc-form-item--top {
  flex-direction: column;
  align-items: stretch;
}
.lc-form-item__label {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 36px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-form-item--left .lc-form-item__label {
  padding-right: 12px;
  box-sizing: border-box;
  text-align: right;
}
.lc-form-item--top .lc-form-item__label {
  line-height: 22px;
  padding-bottom: 2px;
}
.lc-form-item__required {
  color: #f53f3f;
  margin-right: 2px;
}
.lc-form-item__icon {
  margin: 0 2px;
}
.lc-form-item__help {
  margin-left: 3px;
  padding: 0 4px;
  border-radius: 50%;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-style: normal;
  cursor: help;
}
.lc-form-item__control {
  /* EP 的控件高度取自 var(--el-input-height, var(--el-component-size))，
     参考实现的默认尺寸是 Element UI 的 medium（36px），EP 没有这个档位，直接给变量 */
  --el-component-size: 36px;
  --el-input-height: 36px;
  flex: 1;
  min-width: 0;
}
.lc-form-item__error {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: #f53f3f;
}
</style>
