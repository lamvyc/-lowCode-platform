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
.lc-form-item {
  display: flex;
  box-sizing: border-box;
  width: 100%;
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
  font-size: 13px;
  line-height: 32px;
  color: #4e5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-form-item--left .lc-form-item__label {
  padding-right: 8px;
  box-sizing: border-box;
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
