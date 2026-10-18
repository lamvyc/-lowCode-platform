<script setup lang="ts">
import { computed, inject } from 'vue'
import { ElButton, ElInputNumber } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../../useDesigner'
import { childNodesOf } from '../../../structure'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const columns = computed(() =>
  childNodesOf(ctx.schema.value.nodes, props.node).filter((child) => child.type === 'grid-col'),
)

/** 读取列宽；缺失或非法值回落到 12（与物料默认值一致） */
function spanOf(column: PageNode): number {
  const raw = Number(column.props.span)
  return Number.isFinite(raw) ? raw : 12
}

const spanSum = computed(() =>
  columns.value.reduce((sum, column) => sum + spanOf(column), 0),
)

/** 单列宽度：与参考实现的「栅格宽度」输入一致（1–24） */
function setSpan(column: PageNode, next: number | undefined): void {
  if (typeof next !== 'number' || !Number.isFinite(next)) return
  const span = Math.min(24, Math.max(1, Math.round(next)))
  if (span === spanOf(column)) return
  ctx.updateProps(column.id, { span })
}

/**
 * 增加栅格：与参考实现 `addNewColOfGrid` 一致——列宽合计不足 24 时补足剩余宽度
 * （单列最多 12），否则使用默认 12。列数不设上限。
 */
function addColumn(): void {
  ctx.addGridColumn(props.node.id)
}

/**
 * 从栅格面板删除列：保持栅格选中（参考实现的 `deleteColOfGrid` 也只 splice，
 * 不改变当前选中），面板不会跳到相邻栅格列。
 */
function removeColumn(id: string): void {
  ctx.removeGridColumn(id, false)
}

function selectColumn(id: string): void {
  ctx.selectNode(id)
}
</script>

<template>
  <div class="lc-structure-editor">
    <div class="lc-structure-editor__summary">
      <span class="lc-structure-editor__sum">
        列宽合计
        <b :class="{ 'lc-structure-editor__sum--warn': spanSum > 24 }">{{ spanSum }}</b>
        / 24
      </span>
      <el-button size="small" text type="primary" @click="addColumn">+ 增加栅格</el-button>
    </div>

    <div v-if="columns.length === 0" class="lc-structure-editor__empty">
      暂无栅格列，点击「增加栅格」创建
    </div>

    <div
      v-for="(column, index) in columns"
      :key="column.id"
      class="lc-structure-editor__item"
      :class="{ 'lc-structure-editor__item--active': ctx.state.selectedNodeId === column.id }"
      title="点击在画布中选中该栅格列"
      @click="selectColumn(column.id)"
    >
      <span class="lc-structure-editor__item-name">栅格列 {{ index + 1 }}</span>
      <el-input-number
        class="lc-structure-editor__span"
        :model-value="spanOf(column)"
        :min="1"
        :max="24"
        :controls="false"
        size="small"
        @click.stop
        @change="(next: number | undefined) => setSpan(column, next)"
      />
      <el-button
        class="lc-structure-editor__remove"
        size="small"
        text
        type="danger"
        title="删除栅格列"
        @click.stop="removeColumn(column.id)"
      >
        ×
      </el-button>
    </div>

    <p v-if="spanSum > 24" class="lc-structure-editor__warning">
      列宽合计超过 24 格，超出部分会自动换行。
    </p>
    <p v-else class="lc-structure-editor__hint">
      每列可单独设置宽度；把组件拖入画布中的栅格列即可填充内容。
    </p>
  </div>
</template>

<style scoped>
.lc-structure-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-structure-editor__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.lc-structure-editor__sum {
  font-size: 12px;
  color: #4e5969;
}
.lc-structure-editor__sum b {
  font-weight: 600;
  color: #1f2329;
}
.lc-structure-editor__sum--warn {
  color: #f53f3f !important;
}
.lc-structure-editor__empty {
  padding: 6px 8px;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
  font-size: 12px;
  color: #86909c;
}
.lc-structure-editor__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fafbfc;
  cursor: pointer;
}
.lc-structure-editor__item:hover {
  border-color: #3370ff;
}
.lc-structure-editor__item--active {
  border-color: #3370ff;
  box-shadow: inset 0 0 0 1px #3370ff;
}
.lc-structure-editor__item-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #1f2329;
  white-space: nowrap;
}
.lc-structure-editor__span {
  flex-shrink: 0;
  width: 64px;
}
.lc-structure-editor__remove {
  flex-shrink: 0;
  min-width: 22px;
  padding: 0 4px;
  font-size: 15px;
  line-height: 1;
}
.lc-structure-editor__hint,
.lc-structure-editor__warning {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #86909c;
}
.lc-structure-editor__warning {
  color: #f53f3f;
}
</style>
