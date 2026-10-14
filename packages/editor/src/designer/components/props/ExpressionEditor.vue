<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { ElInput, ElRadioButton, ElRadioGroup } from 'element-plus'
import {
  isExpressionBinding,
  isStaticBinding,
  type Binding,
  type PageNode,
  type PropConfig,
} from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'

const props = defineProps<{ node: PageNode; config: PropConfig }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

type BindingMode = 'static' | 'expression'

const raw = computed(() => props.node.props[props.config.name])
const bindingMode = ref<BindingMode>('expression')
const draft = ref('')

function syncFromNode(): void {
  const value = raw.value
  if (isStaticBinding(value)) {
    bindingMode.value = 'static'
    draft.value = typeof value.value === 'string' ? value.value : JSON.stringify(value.value)
  } else if (isExpressionBinding(value)) {
    bindingMode.value = 'expression'
    draft.value = value.value
  } else if (value === undefined || value === null) {
    bindingMode.value = 'expression'
    draft.value = typeof props.config.defaultValue === 'string' ? props.config.defaultValue : ''
  } else {
    // 未按 Binding 声明的历史值：字符串按表达式处理，其余按静态值处理
    bindingMode.value = typeof value === 'string' ? 'expression' : 'static'
    draft.value = typeof value === 'string' ? value : JSON.stringify(value)
  }
}

watch([raw, () => props.config.name], syncFromNode, { immediate: true, deep: true })

function parseStatic(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return text
  }
}

function commit(): void {
  const next: Binding =
    bindingMode.value === 'expression'
      ? { type: 'expression', value: draft.value }
      : { type: 'static', value: parseStatic(draft.value) }
  ctx.updateProps(props.node.id, { [props.config.name]: next })
}

function switchMode(mode: BindingMode): void {
  bindingMode.value = mode
  commit()
}
</script>

<template>
  <div class="lc-expression-editor">
    <el-radio-group
      :model-value="bindingMode"
      size="small"
      class="lc-expression-editor__modes"
      @update:model-value="(value: string | number | boolean | undefined) => switchMode(value as BindingMode)"
    >
      <el-radio-button value="expression">表达式</el-radio-button>
      <el-radio-button value="static">静态值</el-radio-button>
    </el-radio-group>

    <el-input
      v-model="draft"
      :placeholder="
        bindingMode === 'expression'
          ? '沙箱表达式，如 $datasource.userList.data'
          : '静态值（字符串或 JSON）'
      "
      :class="{ 'lc-expression-editor__mono': bindingMode === 'expression' }"
      @change="commit"
      @blur="commit"
    />
    <p class="lc-expression-editor__hint">
      {{
        bindingMode === 'expression'
          ? '表达式在运行时按沙箱上下文求值'
          : '静态值直接作为属性值使用'
      }}
    </p>
  </div>
</template>

<style scoped>
.lc-expression-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-expression-editor__modes {
  align-self: flex-start;
}
.lc-expression-editor__mono :deep(input) {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}
.lc-expression-editor__hint {
  margin: 0;
  font-size: 11px;
  color: #86909c;
}
</style>
