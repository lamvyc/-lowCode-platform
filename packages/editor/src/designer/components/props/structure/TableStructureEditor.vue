<script setup lang="ts">
import { computed, inject } from 'vue'
import { ElButton, ElInputNumber } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../../useDesigner'
import { childNodesOf, planCountChange } from '../../../structure'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const rows = computed(() =>
  childNodesOf(ctx.schema.value.nodes, props.node).filter(
    (child) => child.type === 'table-row',
  ),
)

const rowCount = computed(() => rows.value.length)

/** 以第一行的单元格数作为当前列数 */
const columnCount = computed(() =>
  rows.value.length > 0
    ? childNodesOf(ctx.schema.value.nodes, rows.value[0]).filter(
        (child) => child.type === 'table-cell',
      ).length
    : 0,
)

function setRowCount(next: number | undefined): void {
  if (next === undefined) return
  const { addCount, removeIds } = planCountChange(
    rows.value.map((row) => row.id),
    next,
  )
  // table-row 物料声明了默认子结构（2 个单元格），新增行会自动带上单元格
  if (addCount > 0) ctx.appendChild(props.node.id, 'table-row', addCount)
  if (removeIds.length > 0) ctx.removeNodes(removeIds)
}

/** 调整列数：对每一行分别补齐或裁掉尾部的单元格 */
function setColumnCount(next: number | undefined): void {
  if (next === undefined) return
  for (const row of rows.value) {
    const cells = childNodesOf(ctx.schema.value.nodes, row).filter(
      (child) => child.type === 'table-cell',
    )
    const { addCount, removeIds } = planCountChange(
      cells.map((cell) => cell.id),
      next,
    )
    if (addCount > 0) ctx.appendChild(row.id, 'table-cell', addCount)
    if (removeIds.length > 0) ctx.removeNodes(removeIds)
  }
}

function addRow(): void {
  ctx.appendChild(props.node.id, 'table-row')
}

function selectCell(id: string): void {
  ctx.selectNode(id)
}
</script>

<template>
  <div class="lc-structure-editor">
    <div class="lc-structure-editor__row">
      <span class="lc-structure-editor__label">行数</span>
      <el-input-number
        :model-value="rowCount"
        :min="1"
        :max="10"
        :controls="false"
        size="small"
        style="width: 100%"
        @change="setRowCount"
      />
    </div>
    <div class="lc-structure-editor__row">
      <span class="lc-structure-editor__label">列数</span>
      <el-input-number
        :model-value="columnCount"
        :min="1"
        :max="6"
        :controls="false"
        size="small"
        style="width: 100%"
        @change="setColumnCount"
      />
    </div>

    <div class="lc-structure-editor__list">
      <div v-for="(row, index) in rows" :key="row.id" class="lc-structure-editor__item">
        <span class="lc-structure-editor__item-name">
          第 {{ index + 1 }} 行
          <template v-if="!(row.children ?? []).length">
            <el-button size="small" text @click="addRow">补单元格</el-button>
          </template>
        </span>
        <span class="lc-structure-editor__cells">
          <el-button
            v-for="(cell, cellIndex) in childNodesOf(ctx.schema.value.nodes, row)"
            :key="cell.id"
            size="small"
            text
            @click="selectCell(cell.id)"
          >
            {{ cellIndex + 1 }}
          </el-button>
        </span>
      </div>
    </div>

    <p class="lc-structure-editor__hint">
      选中单元格后可在「组件设置」中调整 colspan / rowspan / 宽高；把组件拖入单元格即可填充内容。
    </p>
  </div>
</template>

<style scoped>
.lc-structure-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-structure-editor__row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lc-structure-editor__label {
  flex-shrink: 0;
  width: 44px;
  font-size: 12px;
  color: #4e5969;
}
.lc-structure-editor__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lc-structure-editor__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 6px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fafbfc;
}
.lc-structure-editor__item-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #1f2329;
}
.lc-structure-editor__cells {
  display: flex;
  gap: 2px;
}
.lc-structure-editor__hint {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #86909c;
}
</style>
