<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ElButton, ElButtonGroup, ElDialog, ElInput, ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  Document,
  Download,
  Operation,
  RefreshLeft,
  RefreshRight,
  Upload,
  View,
} from '@element-plus/icons-vue'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import type { DeviceType } from '../types'
import NodeTreeDrawer from './NodeTreeDrawer.vue'
import SfcDialog from './SfcDialog.vue'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { schema, state, canUndo, canRedo } = ctx

const zoomPercent = computed(() => Math.round(state.zoom * 100))

function zoomIn(): void {
  ctx.setZoom(Number((state.zoom + 0.1).toFixed(1)))
}
function zoomOut(): void {
  ctx.setZoom(Number((state.zoom - 0.1).toFixed(1)))
}
function resetZoom(): void {
  ctx.setZoom(1)
}

const DEVICES: Array<{ label: string; value: DeviceType }> = [
  { label: 'PC', value: 'pc' },
  { label: 'Pad', value: 'pad' },
  { label: 'H5', value: 'h5' },
]

/* ---------------- 节点树 ---------------- */
const nodeTreeVisible = ref(false)

/* ---------------- 生成 SFC ---------------- */
const sfcVisible = ref(false)

/* ---------------- 导入 / 导出 JSON ---------------- */
const importVisible = ref(false)
const importText = ref('')
const exportVisible = ref(false)
const exportText = ref('')

function openImport(): void {
  importText.value = ''
  importVisible.value = true
}

function fillCurrentSchema(): void {
  importText.value = ctx.exportSchema()
}

function confirmImport(): void {
  const result = ctx.importSchema(importText.value)
  if (result.ok) {
    ElMessage.success('导入成功')
    importVisible.value = false
  } else {
    ElMessage.error(`导入失败：${result.error}`)
  }
}

function openExport(): void {
  exportText.value = ctx.exportSchema()
  exportVisible.value = true
}

async function copyText(text: string, tip: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(tip)
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

/** Blob 下载，替代 file-saver 依赖 */
function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function downloadSchema(): void {
  downloadText(exportText.value, `${schema.value.meta.name || 'page'}.json`)
}

function handleClear(): void {
  ElMessageBox.confirm('确认清空画布？此操作可撤销。', '清空', {
    type: 'warning',
    confirmButtonText: '清空',
    cancelButtonText: '取消',
  })
    .then(() => {
      ctx.clear()
      ElMessage.success('已清空')
    })
    .catch(() => {})
}
</script>

<template>
  <header class="lc-toolbar">
    <div class="lc-toolbar__brand">
      <span class="lc-toolbar__logo">LC</span>
      <span class="lc-toolbar__name">低代码设计器</span>
      <span class="lc-toolbar__version">v1.0</span>
      <span class="lc-toolbar__page">{{ schema.meta.name }}</span>
    </div>

    <div class="lc-toolbar__group">
      <el-button
        :icon="RefreshLeft"
        :disabled="!canUndo"
        title="撤销（Ctrl/Cmd + Z）"
        @click="ctx.undo()"
      >
        撤销
      </el-button>
      <el-button
        :icon="RefreshRight"
        :disabled="!canRedo"
        title="重做（Ctrl/Cmd + Shift + Z）"
        @click="ctx.redo()"
      >
        重做
      </el-button>

      <el-button-group class="lc-toolbar__devices">
        <el-button
          v-for="d in DEVICES"
          :key="d.value"
          :type="state.device === d.value ? 'primary' : 'default'"
          @click="ctx.setDevice(d.value)"
        >
          {{ d.label }}
        </el-button>
      </el-button-group>

      <div class="lc-toolbar__zoom">
        <el-button @click="zoomOut">－</el-button>
        <span class="lc-toolbar__zoom-value">{{ zoomPercent }}%</span>
        <el-button @click="zoomIn">＋</el-button>
        <el-button @click="resetZoom">100%</el-button>
      </div>

      <el-button
        :icon="Operation"
        title="组件层次结构树"
        @click="nodeTreeVisible = true"
      >
        结构树
      </el-button>
    </div>

    <div class="lc-toolbar__group">
      <el-button :icon="Delete" @click="handleClear">清空</el-button>
      <el-button :icon="Upload" @click="openImport">导入 JSON</el-button>
      <el-button :icon="Download" @click="openExport">导出 JSON</el-button>
      <el-button :icon="Document" @click="sfcVisible = true">生成 SFC</el-button>
      <el-button type="primary" :icon="View" @click="ctx.togglePreview()">预览</el-button>
    </div>

    <el-dialog v-model="importVisible" title="导入 JSON" width="620px" append-to-body>
      <p class="lc-toolbar__hint">粘贴页面 Schema JSON（支持旧版扁平结构与统一 2.x 结构）</p>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="16"
        placeholder="粘贴页面 Schema JSON"
      />
      <template #footer>
        <el-button text @click="fillCurrentSchema">载入当前 Schema</el-button>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmImport">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exportVisible" title="导出 JSON" width="620px" append-to-body>
      <el-input v-model="exportText" type="textarea" :rows="16" readonly />
      <template #footer>
        <el-button @click="exportVisible = false">关闭</el-button>
        <el-button @click="downloadSchema">下载文件</el-button>
        <el-button type="primary" @click="copyText(exportText, '已复制到剪贴板')">复制</el-button>
      </template>
    </el-dialog>

    <NodeTreeDrawer v-model="nodeTreeVisible" />
    <SfcDialog v-model="sfcVisible" :schema="schema" />
  </header>
</template>

<style scoped>
.lc-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 48px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.lc-toolbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
}
.lc-toolbar__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #3370ff;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.lc-toolbar__name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.lc-toolbar__version {
  font-size: 12px;
  color: #86909c;
}
.lc-toolbar__page {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 8px;
  border-radius: 10px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 12px;
}
.lc-toolbar__group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lc-toolbar__group:last-of-type {
  margin-left: auto;
}
.lc-toolbar__devices {
  margin: 0 8px;
}
.lc-toolbar__zoom {
  display: flex;
  align-items: center;
  gap: 2px;
}
.lc-toolbar__zoom-value {
  min-width: 44px;
  text-align: center;
  font-size: 13px;
  color: #4e5969;
}
.lc-toolbar__hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #86909c;
}
</style>
