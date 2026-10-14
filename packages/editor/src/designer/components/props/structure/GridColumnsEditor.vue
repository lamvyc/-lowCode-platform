<script setup lang="ts">
import { computed, inject } from 'vue'
import { ElButton, ElInputNumber } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../../useDesigner'
import { childNodesOf, planCountChange } from '../../../structure'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const columns = computed(() =>
  childNodesOf(ctx.schema.value.nodes, props.node).filter((child) => child.type === 'grid-col'),
)

const columnCount = computed(() => columns.value.length)

/** 调整栅格列数量：多退少补，已有列上的内容保持不变 */
function setColumnCount(next: number | undefined): void {
  if (next === undefined) return
  const { addCount, removeIds } = planCountChange(
    columns.value.map((column) => column.id),
    next,
  )
  if (addCount > 0) ctx.appendChild(props.node.id, 'grid-col', addCount)
  if (removeIds.length > 0) ctx.removeNodes(removeIds)
}

function selectColumn(id: string): void {
  ctx.selectNode(id)
}
</script>

<template>
  <div class="lc-structure-editor">
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
      <div v-for="(column, index) in columns" :key="column.id" class="lc-structure-editor__item">
        <span class="lc-structure-editor__item-name">
          栅格列 {{ index + 1 }}
          <code>{{ column.name ?? column.id }}</code>
        </span>
        <el-button size="small" text @click="selectColumn(column.id)">配置</el-button>
      </div>
    </div>

    <p class="lc-structure-editor__hint">
      选中栅格列后可在「组件设置」中调整 span / offset / 响应式断点；把组件拖入栅格列即可填充内容。
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
  gap: 6px;
  font-size: 12px;
  color: #1f2329;
}
.lc-structure-editor__item-name code {
  font-size: 11px;
  color: #86909c;
}
.lc-structure-editor__hint {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #86909c;
}
</style>
