<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElColorPicker,
  ElInput,
  ElInputNumber,
  ElOption,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElSwitch,
  ElTooltip,
} from 'element-plus'
import type { PageNode, PropConfig } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'
import { readPropValue } from '../../props-config'
import type { CodeMode } from '../../code'
import NameEditor from './NameEditor.vue'
import StyleEditor from './StyleEditor.vue'
import JsonEditor from './JsonEditor.vue'
import ExpressionEditor from './ExpressionEditor.vue'
import OptionItemsEditor from './OptionItemsEditor.vue'
import CodeDialog from './CodeDialog.vue'
import GridColumnsEditor from './structure/GridColumnsEditor.vue'
import TableStructureEditor from './structure/TableStructureEditor.vue'
import TabPanesEditor from './structure/TabPanesEditor.vue'

const props = defineProps<{
  node: PageNode
  config: PropConfig
  /** 表单自定义 CSS 中提取出的类名 */
  customClasses: string[]
}>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const value = computed<unknown>(() => readPropValue(props.node, props.config))

function setValue(next: unknown): void {
  ctx.updateProps(props.node.id, { [props.config.name]: next })
}

function toText(input: unknown): string {
  return input === undefined || input === null ? '' : String(input)
}

/** 下拉/单选：优先写回选项声明中的原始值类型 */
function setOptionValue(next: string): void {
  const matched = props.config.options?.find((option) => String(option.value) === next)
  setValue(matched ? matched.value : next)
}

/* ---- 节点级系统属性（非组件 props） ---- */

const hidden = computed(() => Boolean(props.node.meta?.hidden))
function setHidden(next: boolean): void {
  ctx.updateNode(props.node.id, (node) => ({
    ...node,
    meta: { ...(node.meta ?? {}), hidden: next },
  }))
}

const customClassValue = computed<string[]>(() => {
  const raw = props.node.props.class
  if (Array.isArray(raw)) return raw.map((item) => String(item))
  if (typeof raw === 'string' && raw) return raw.split(/\s+/).filter(Boolean)
  return []
})
function setCustomClass(next: string[]): void {
  setValue(next.length > 0 ? next : undefined)
}

const checkboxValue = computed<string[]>(() =>
  Array.isArray(value.value) ? value.value.map((item) => String(item)) : [],
)

/* ---- code 控件：对话框内编辑 ---- */

const codeVisible = ref(false)
const codeDraft = ref('')

const codeMode = computed<CodeMode>(() => {
  const editor = props.config.editor
  return editor === 'css' || editor === 'json' || editor === 'html' ? editor : 'javascript'
})

function openCodeDialog(): void {
  codeDraft.value =
    typeof value.value === 'string'
      ? value.value
      : value.value === undefined
        ? ''
        : JSON.stringify(value.value, null, 2)
  codeVisible.value = true
}

function saveCode(next: string): void {
  if (codeMode.value === 'json') {
    try {
      setValue(next.trim() ? JSON.parse(next) : undefined)
      return
    } catch {
      setValue(next)
      return
    }
  }
  setValue(next)
}
</script>

<template>
  <div class="lc-field">
    <label class="lc-field__label">
      <span>{{ config.label }}</span>
      <el-tooltip v-if="config.description" effect="light" placement="top" :content="config.description">
        <span class="lc-field__help">?</span>
      </el-tooltip>
    </label>

    <NameEditor v-if="config.control === 'name'" :node="node" />

    <el-input
      v-else-if="config.control === 'label'"
      :model-value="toText(node.props.label)"
      placeholder="组件标签"
      @update:model-value="(next: string) => setValue(next)"
    />

    <el-switch
      v-else-if="config.control === 'hidden'"
      :model-value="hidden"
      @update:model-value="(next: string | number | boolean) => setHidden(Boolean(next))"
    />

    <StyleEditor v-else-if="config.control === 'style'" :node="node" />

    <el-select
      v-else-if="config.control === 'custom-class'"
      :model-value="customClassValue"
      multiple
      filterable
      allow-create
      default-first-option
      placeholder="选择或输入类名"
      style="width: 100%"
      @update:model-value="(next: string[]) => setCustomClass(next)"
    >
      <el-option v-for="name in customClasses" :key="name" :label="`.${name}`" :value="name" />
    </el-select>

    <el-input
      v-else-if="config.control === 'input'"
      :model-value="toText(value)"
      :placeholder="config.placeholder"
      @update:model-value="(next: string) => setValue(next)"
    />

    <el-input
      v-else-if="config.control === 'textarea'"
      type="textarea"
      :rows="3"
      :model-value="toText(value)"
      :placeholder="config.placeholder"
      @update:model-value="(next: string) => setValue(next)"
    />

    <el-input-number
      v-else-if="config.control === 'number'"
      :model-value="value === undefined || value === null ? undefined : Number(value)"
      :min="config.range?.min"
      :max="config.range?.max"
      :step="config.range?.step ?? 1"
      :controls="false"
      style="width: 100%"
      @update:model-value="(next: number | undefined) => setValue(next)"
    />

    <el-select
      v-else-if="config.control === 'select'"
      :model-value="toText(value)"
      :placeholder="config.placeholder ?? '请选择'"
      style="width: 100%"
      @update:model-value="(next: string) => setOptionValue(next)"
    >
      <el-option
        v-for="option in config.options ?? []"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-select>

    <el-switch
      v-else-if="config.control === 'switch'"
      :model-value="Boolean(value)"
      @update:model-value="(next: string | number | boolean) => setValue(Boolean(next))"
    />

    <el-color-picker
      v-else-if="config.control === 'color'"
      :model-value="toText(value)"
      show-alpha
      @update:model-value="(next: string | null) => setValue(next ?? '')"
    />

    <el-radio-group
      v-else-if="config.control === 'radio'"
      :model-value="toText(value)"
      @update:model-value="(next: string | number | boolean | undefined) => setOptionValue(String(next))"
    >
      <el-radio v-for="option in config.options ?? []" :key="option.value" :value="option.value">
        {{ option.label }}
      </el-radio>
    </el-radio-group>

    <el-radio-group
      v-else-if="config.control === 'radio-button'"
      :model-value="toText(value)"
      @update:model-value="(next: string | number | boolean | undefined) => setOptionValue(String(next))"
    >
      <el-radio-button v-for="option in config.options ?? []" :key="option.value" :value="option.value">
        {{ option.label }}
      </el-radio-button>
    </el-radio-group>

    <el-checkbox-group
      v-else-if="config.control === 'checkbox'"
      :model-value="checkboxValue"
      @update:model-value="(next: Array<string | number>) => setValue(next.map((item) => String(item)))"
    >
      <el-checkbox v-for="option in config.options ?? []" :key="option.value" :value="option.value">
        {{ option.label }}
      </el-checkbox>
    </el-checkbox-group>

    <ExpressionEditor
      v-else-if="config.control === 'expression'"
      :node="node"
      :config="config"
    />

    <OptionItemsEditor
      v-else-if="config.control === 'option-items'"
      :model-value="value"
      @update:model-value="(next: unknown) => setValue(next)"
    />

    <GridColumnsEditor
      v-else-if="config.control === 'structure' && config.editor === 'grid-columns'"
      :node="node"
    />

    <TableStructureEditor
      v-else-if="config.control === 'structure' && config.editor === 'table-structure'"
      :node="node"
    />

    <TabPanesEditor
      v-else-if="config.control === 'structure' && config.editor === 'tab-panes'"
      :node="node"
    />

    <JsonEditor
      v-else-if="config.control === 'json'"
      :model-value="value"
      :placeholder="config.placeholder ?? '请输入合法 JSON'"
      @update:model-value="(next: unknown) => setValue(next)"
    />

    <template v-else-if="config.control === 'code' || config.control === 'monaco'">
      <el-button size="small" plain @click="openCodeDialog">编辑{{ codeMode === 'json' ? ' JSON' : '代码' }}</el-button>
      <CodeDialog
        v-model:visible="codeVisible"
        :title="`${config.label} · ${codeMode}`"
        :mode="codeMode"
        :code="codeDraft"
        :description="config.description"
        @confirm="saveCode"
      />
    </template>

    <span v-else class="lc-field__todo">{{ config.control }} 控件待支持</span>
  </div>
</template>

<style scoped>
.lc-field {
  margin-bottom: 12px;
}
.lc-field__label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #4e5969;
}
.lc-field__help {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  cursor: help;
}
.lc-field__todo {
  display: inline-block;
  padding: 4px 8px;
  font-size: 12px;
  color: #86909c;
  background: #f2f3f5;
  border-radius: 4px;
}
</style>
