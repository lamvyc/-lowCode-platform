<script setup lang="ts">
import { computed, inject } from 'vue'
import { ElButton, ElInput } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../../useDesigner'
import { childNodesOf, moveItem } from '../../../structure'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

const panes = computed(() =>
  childNodesOf(ctx.schema.value.nodes, props.node).filter(
    (child) => child.type === 'tab-pane',
  ),
)

function paneIds(): string[] {
  return (props.node.children ?? []).filter((id) =>
    panes.value.some((pane) => pane.id === id),
  )
}

function addPane(): void {
  const [id] = ctx.appendChild(props.node.id, 'tab-pane')
  if (id) ctx.selectNode(id)
}

function removePane(id: string): void {
  ctx.removeNodes([id])
}

function renamePane(id: string, label: string): void {
  ctx.updateProps(id, { label })
}

/** 标签页顺序即 children 顺序，直接就地交换 */
function movePane(index: number, direction: -1 | 1): void {
  const ids = moveItem(paneIds(), index, direction)
  ctx.updateNode(props.node.id, (node) => ({ ...node, children: ids }))
}

function selectPane(id: string): void {
  ctx.selectNode(id)
}
</script>

<template>
  <div class="lc-structure-editor">
    <div v-for="(pane, index) in panes" :key="pane.id" class="lc-tab-pane-row">
      <el-input
        size="small"
        :model-value="String(pane.props.label ?? '')"
        placeholder="标签页名称"
        @update:model-value="(value: string) => renamePane(pane.id, value)"
      />
      <button
        class="lc-tab-pane-row__btn"
        type="button"
        title="上移"
        :disabled="index === 0"
        @click="movePane(index, -1)"
      >
        ↑
      </button>
      <button
        class="lc-tab-pane-row__btn"
        type="button"
        title="下移"
        :disabled="index === panes.length - 1"
        @click="movePane(index, 1)"
      >
        ↓
      </button>
      <button
        class="lc-tab-pane-row__btn lc-tab-pane-row__btn--danger"
        type="button"
        title="删除"
        :disabled="panes.length <= 1"
        @click="removePane(pane.id)"
      >
        ✕
      </button>
      <el-button size="small" text @click="selectPane(pane.id)">进入</el-button>
    </div>

    <el-button size="small" plain class="lc-structure-editor__add" @click="addPane">
      + 添加标签页
    </el-button>
  </div>
</template>

<style scoped>
.lc-structure-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-tab-pane-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.lc-tab-pane-row__btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 3px;
  background: #fff;
  color: #4e5969;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.lc-tab-pane-row__btn:hover:not(:disabled) {
  border-color: #3370ff;
  color: #3370ff;
}
.lc-tab-pane-row__btn:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}
.lc-tab-pane-row__btn--danger:hover:not(:disabled) {
  border-color: #f53f3f;
  color: #f53f3f;
}
.lc-structure-editor__add {
  width: 100%;
}
</style>
