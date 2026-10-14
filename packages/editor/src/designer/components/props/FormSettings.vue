<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElDivider,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
} from 'element-plus'
import {
  extractCssClassNames,
  FORM_EVENT_CONFIGS,
  FORM_LABEL_ALIGN_OPTIONS,
  FORM_LABEL_POSITION_OPTIONS,
  FORM_SIZE_OPTIONS,
  type FormEventConfig,
  type FormLabelAlign,
  type FormLabelPosition,
  type FormSettings as FormSettingsModel,
  type FormSize,
} from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'
import type { CodeMode } from '../../code'
import CodeDialog from './CodeDialog.vue'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { formSettings, updateFormSettings, resetFormSettings } = ctx

/** 从自定义 CSS 中提取可复用的类名 */
const cssClasses = computed(() => extractCssClassNames(formSettings.value.cssCode))

function patch(next: Partial<FormSettingsModel>): void {
  updateFormSettings(next)
}

/** el-input 的 update:model-value 载荷可能为 undefined，统一转字符串 */
function toStr(value: string | number | boolean | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

/* ---- 代码对话框：CSS / 全局函数 / 表单事件共用 ---- */

type DialogTarget =
  | { kind: 'css' }
  | { kind: 'functions' }
  | { kind: 'event'; event: FormEventConfig }

const dialogTarget = ref<DialogTarget | null>(null)

const dialogMode = computed<CodeMode>(() => (dialogTarget.value?.kind === 'css' ? 'css' : 'javascript'))

const dialogTitle = computed(() => {
  const target = dialogTarget.value
  if (!target) return ''
  if (target.kind === 'css') return '编辑表单 CSS'
  if (target.kind === 'functions') return '编辑全局函数'
  return `编辑表单事件：${target.event.label}`
})

const dialogSignature = computed(() => {
  const target = dialogTarget.value
  if (!target || target.kind !== 'event') return ''
  return `form.${target.event.name}(${target.event.params.join(', ')}) {`
})

const dialogDescription = computed(() => {
  const target = dialogTarget.value
  if (!target) return ''
  if (target.kind === 'css') return '样式会注入到画布与运行时的 <head>，并可在「自定义类名」中引用'
  if (target.kind === 'functions') return '全局函数可在表达式与事件动作中被引用'
  return target.event.description
})

const dialogCode = computed(() => {
  const target = dialogTarget.value
  if (!target) return ''
  if (target.kind === 'css') return formSettings.value.cssCode ?? ''
  if (target.kind === 'functions') return formSettings.value.functions ?? ''
  return formSettings.value[target.event.name] ?? ''
})

function openDialog(target: DialogTarget): void {
  dialogTarget.value = target
}

function onConfirm(code: string): void {
  const target = dialogTarget.value
  if (!target) return
  if (target.kind === 'css') {
    patch({ cssCode: code })
    ElMessage.success('表单 CSS 已更新')
  } else if (target.kind === 'functions') {
    patch({ functions: code })
    ElMessage.success('全局函数已更新')
  } else {
    patch({ [target.event.name]: code })
    ElMessage.success('表单事件已更新')
  }
  dialogTarget.value = null
}

function clearEvent(event: FormEventConfig): void {
  patch({ [event.name]: '' })
}

function restoreDefaults(): void {
  resetFormSettings()
  ElMessage.success('已恢复表单默认设置')
}

/** 表单尺寸写回（保持联合类型收窄） */
function setSize(value: string | number | boolean | undefined): void {
  patch({ size: String(value) as FormSize })
}

function setLabelPosition(value: string | number | boolean | undefined): void {
  patch({ labelPosition: String(value) as FormLabelPosition })
}

function setLabelAlign(value: string | number | boolean | undefined): void {
  patch({ labelAlign: String(value) as FormLabelAlign })
}

const activeNames = ref<string[]>(['basic', 'event'])
</script>

<template>
  <div class="lc-form-settings">
    <el-collapse v-model="activeNames" class="lc-setting-collapse">
      <el-collapse-item name="basic">
        <template #title>
          <span class="lc-setting-collapse__title">基础设置</span>
        </template>

        <p class="lc-form-settings__hint">
          表单级配置：标签排版与 CSS 会即时作用于画布，SFC 命名与事件用于代码生成输出。
        </p>

        <div class="lc-field">
          <label class="lc-field__label">表单尺寸</label>
          <el-select :model-value="formSettings.size" style="width: 100%" @update:model-value="setSize">
            <el-option
              v-for="option in FORM_SIZE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>

        <div class="lc-field">
          <label class="lc-field__label">标签位置</label>
          <el-radio-group :model-value="formSettings.labelPosition" @update:model-value="setLabelPosition">
            <el-radio-button
              v-for="option in FORM_LABEL_POSITION_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </div>

        <div class="lc-field">
          <label class="lc-field__label">标签对齐</label>
          <el-radio-group :model-value="formSettings.labelAlign" @update:model-value="setLabelAlign">
            <el-radio-button
              v-for="option in FORM_LABEL_ALIGN_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </div>

        <div class="lc-field">
          <label class="lc-field__label">标签宽度</label>
          <el-input-number
            :model-value="formSettings.labelWidth"
            :min="0"
            :max="400"
            :controls="false"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => patch({ labelWidth: value ?? 0 })"
          />
        </div>

        <div class="lc-field">
          <label class="lc-field__label">自定义类名</label>
          <el-select
            :model-value="formSettings.customClass ?? []"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入类名"
            style="width: 100%"
            @update:model-value="(value: string[]) => patch({ customClass: value })"
          >
            <el-option v-for="name in cssClasses" :key="name" :label="`.${name}`" :value="name" />
          </el-select>
        </div>

        <div class="lc-field">
          <label class="lc-field__label">表单 CSS</label>
          <el-button size="small" plain style="width: 100%" @click="openDialog({ kind: 'css' })">
            编辑自定义 CSS
          </el-button>
          <p class="lc-field__hint">
            已定义 {{ cssClasses.length }} 个类名
          </p>
        </div>

        <div class="lc-field">
          <label class="lc-field__label">全局函数</label>
          <el-button size="small" plain style="width: 100%" @click="openDialog({ kind: 'functions' })">
            编辑全局函数
          </el-button>
        </div>

        <el-divider class="lc-form-settings__divider">表单 SFC 设置</el-divider>

        <div class="lc-field">
          <label class="lc-field__label">表单模型名</label>
          <el-input
            :model-value="formSettings.modelName"
            placeholder="formData"
            @update:model-value="(value: string | number | boolean | undefined) => patch({ modelName: toStr(value) })"
          />
        </div>

        <div class="lc-field">
          <label class="lc-field__label">表单 ref 名</label>
          <el-input
            :model-value="formSettings.refName"
            placeholder="formRef"
            @update:model-value="(value: string | number | boolean | undefined) => patch({ refName: toStr(value) })"
          />
        </div>

        <div class="lc-field">
          <label class="lc-field__label">校验规则名</label>
          <el-input
            :model-value="formSettings.rulesName"
            placeholder="formRules"
            @update:model-value="(value: string | number | boolean | undefined) => patch({ rulesName: toStr(value) })"
          />
        </div>
      </el-collapse-item>

      <el-collapse-item name="event">
        <template #title>
          <span class="lc-setting-collapse__title">事件设置</span>
        </template>

        <div v-for="event in FORM_EVENT_CONFIGS" :key="event.name" class="lc-form-event">
          <div class="lc-form-event__head">
            <span class="lc-form-event__name">{{ event.label }}</span>
            <span v-if="formSettings[event.name]" class="lc-form-event__badge">已配置</span>
          </div>
          <p class="lc-form-event__desc">{{ event.description }}</p>
          <div class="lc-form-event__actions">
            <el-button size="small" type="primary" plain @click="openDialog({ kind: 'event', event })">
              {{ formSettings[event.name] ? '编辑事件' : '添加事件' }}
            </el-button>
            <el-button v-if="formSettings[event.name]" size="small" text @click="clearEvent(event)">
              清空
            </el-button>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div class="lc-form-settings__footer">
      <el-button size="small" plain @click="restoreDefaults">恢复默认设置</el-button>
    </div>

    <CodeDialog
      :visible="dialogTarget !== null"
      :title="dialogTitle"
      :mode="dialogMode"
      :code="dialogCode"
      :signature="dialogSignature"
      :description="dialogDescription"
      @update:visible="(value: boolean) => !value && (dialogTarget = null)"
      @confirm="onConfirm"
    />
  </div>
</template>

<style scoped>
.lc-form-settings {
  padding-bottom: 16px;
}
.lc-setting-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  border-bottom-color: #f2f3f5;
}
.lc-setting-collapse :deep(.el-collapse-item__content) {
  padding: 10px 4px 4px;
}
.lc-setting-collapse__title {
  font-style: italic;
}
.lc-field {
  margin-bottom: 12px;
}
.lc-form-settings__hint {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 16px;
  color: #86909c;
}
.lc-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #4e5969;
}
.lc-field__hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #86909c;
}
.lc-form-settings__divider {
  margin: 12px 0;
}
.lc-form-settings__divider :deep(.el-divider__text) {
  font-size: 12px;
  color: #86909c;
}
.lc-form-event {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  background: #fafbfc;
}
.lc-form-event__head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lc-form-event__name {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #1f2329;
}
.lc-form-event__badge {
  padding: 0 5px;
  border-radius: 8px;
  background: #e8f3ff;
  color: #3370ff;
  font-size: 11px;
  line-height: 16px;
}
.lc-form-event__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #86909c;
  line-height: 16px;
}
.lc-form-event__actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.lc-form-settings__footer {
  padding: 8px 4px 0;
}
</style>
