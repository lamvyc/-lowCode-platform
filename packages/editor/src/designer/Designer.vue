<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage } from 'element-plus'
import type { PageSchema } from '@lowcode/schema'
import { RuntimeRenderer } from '@lowcode/runtime'
import { materialRegistry } from '../platform'
import { DESIGNER_KEY, useDesigner } from './useDesigner'
import Toolbar from './components/Toolbar.vue'
import MaterialPanel from './components/MaterialPanel.vue'
import Canvas from './components/Canvas.vue'
import PropsPanel from './components/PropsPanel.vue'

const props = defineProps<{ schema: PageSchema }>()

const ctx = useDesigner({ schema: props.schema })
provide(DESIGNER_KEY, ctx)

const { state, schema, runtime, setPreview, undo, redo, removeNode, copyNode, pasteClipboard } = ctx

/* ------------------------------------------------------------------ *
 * 预览：参考 variant-form 的预览弹窗
 *
 * 参考是 `el-dialog` + VFormRender，底部按钮：获取数据 / 重置表单 /
 * 禁用编辑 / 恢复编辑 / 关闭。这里用同一个 RuntimeRenderer（designMode=false）
 * 渲染在弹窗内，不再整页替换设计器。
 * ------------------------------------------------------------------ */

const previewVisible = computed({
  get: () => state.preview,
  set: (value: boolean) => setPreview(value),
})

const formDataVisible = ref(false)
const formDataJson = ref('')

/** 预览态字段（有 modelValue 的节点） */
function previewFieldNodes() {
  return runtime.value.schema.nodes.filter((node) => 'modelValue' in node.props)
}

/** 可禁用/启用的控件（物料默认属性里声明了 disabled） */
function previewControlNodes() {
  return runtime.value.schema.nodes.filter((node) => {
    const material = materialRegistry.get(node.type)
    return Boolean(material && 'disabled' in material.defaultProps)
  })
}

/**
 * 每次打开/关闭预览都清掉运行期覆盖，保证：
 * - 预览从 schema 默认值开始，不带上画布上试输入的内容；
 * - 关闭后画布回到默认值，"禁用编辑"不会泄漏回设计器。
 */
function resetPreviewRuntime(): void {
  const current = runtime.value
  if (!current) return
  for (const key of Object.keys(current.overrides)) delete current.overrides[key]
  current.clearFieldErrors()
}

watch(
  () => state.preview,
  (open) => {
    resetPreviewRuntime()
    if (!open) formDataVisible.value = false
  },
)

/** 获取数据：先整表校验（参考 getFormData 的语义），通过后展示 JSON */
function getFormData(): void {
  const current = runtime.value
  if (!current) return
  if (!current.validateAll()) {
    ElMessage.error('表单校验未通过，请检查红色提示')
    return
  }
  const data: Record<string, unknown> = {}
  for (const node of previewFieldNodes()) {
    data[node.name ?? node.id] = current.getNodeValue(node.id)
  }
  formDataJson.value = JSON.stringify(data, null, 2)
  formDataVisible.value = true
}

/** 重置表单：字段值回到 schema 默认值，并清空校验错误 */
function resetForm(): void {
  const current = runtime.value
  if (!current) return
  for (const node of previewFieldNodes()) current.resetNodeValue(node.id)
  current.clearFieldErrors()
  ElMessage.success('表单已重置')
}

/** 禁用 / 恢复编辑：通过运行时覆盖写 disabled，不修改 schema */
function setFormDisabled(disabled: boolean): void {
  const current = runtime.value
  if (!current) return
  for (const node of previewControlNodes()) {
    current.setNodeProp(node.id, 'disabled', disabled)
  }
  ElMessage.success(disabled ? '表单已禁用编辑' : '表单已恢复编辑')
}

async function copyFormData(): Promise<void> {
  try {
    await navigator.clipboard.writeText(formDataJson.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (state.preview) return
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return
  }

  const mod = event.ctrlKey || event.metaKey
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedNodeId) {
    event.preventDefault()
    removeNode(state.selectedNodeId)
  } else if (mod && (event.key === 'c' || event.key === 'C') && state.selectedNodeId) {
    event.preventDefault()
    copyNode(state.selectedNodeId)
  } else if (mod && (event.key === 'v' || event.key === 'V')) {
    event.preventDefault()
    pasteClipboard()
  } else if (mod && event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    redo()
  } else if (mod && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    undo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="lc-designer">
    <Toolbar />
    <div class="lc-designer__body">
      <MaterialPanel />
      <Canvas />
      <PropsPanel />
    </div>

    <!-- 预览弹窗：与参考 variant-form 一致，不再整页替换设计器 -->
    <el-dialog
      v-model="previewVisible"
      title="预览"
      width="75%"
      center
      append-to-body
      destroy-on-close
      class="lc-preview-dialog"
      :fullscreen="state.device !== 'pc'"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <template #header>
        <span class="lc-preview-title">预览</span>
      </template>
      <div
        class="lc-preview-dialog__canvas lc-preview-body"
        :class="`lc-preview-dialog__canvas--${state.device}`"
      >
        <RuntimeRenderer
          v-if="schema && runtime"
          :schema="schema"
          :context="runtime"
          :layout-type="state.device"
        />
      </div>

      <template #footer>
        <el-button type="primary" @click="getFormData">获取数据</el-button>
        <el-button type="primary" @click="resetForm">重置表单</el-button>
        <el-button type="primary" @click="setFormDisabled(true)">禁用编辑</el-button>
        <el-button type="primary" @click="setFormDisabled(false)">恢复编辑</el-button>
        <el-button class="lc-preview-close" @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 获取数据的结果（只读 JSON + 复制） -->
    <el-dialog
      v-model="formDataVisible"
      title="表单数据"
      width="560px"
      append-to-body
      class="lc-form-data-dialog"
    >
      <el-input v-model="formDataJson" type="textarea" :rows="16" readonly />
      <template #footer>
        <el-button @click="copyFormData">复制</el-button>
        <el-button type="primary" @click="formDataVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.lc-designer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2f3f5;
}
.lc-designer__body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* 预览画布：PC 白底；Pad / H5 参考 variant-form 的 960 / 420 宽度 + 设备阴影 */
.lc-preview-dialog__canvas {
  box-sizing: border-box;
  padding: 16px;
  background: #f2f3f5;
  max-height: 65vh;
  overflow: auto;
}
.lc-preview-dialog__canvas--pc {
  padding: 24px;
  background: #fff;
}
.lc-preview-dialog__canvas--pad,
.lc-preview-dialog__canvas--h5 {
  min-height: calc(100vh - 160px);
  max-height: none;
  padding: 24px;
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 0 1px 10px #495060;
}
.lc-preview-dialog__canvas--pad {
  max-width: 960px;
  margin: 0 auto;
}
.lc-preview-dialog__canvas--h5 {
  max-width: 420px;
  margin: 0 auto;
}
</style>
