<script setup lang="ts">
import { computed, h, inject, type VNode } from 'vue'
import type { PageNode } from '@lowcode/schema'
import { RuntimeRenderer } from '@lowcode/runtime'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { deviceWidth } from '../device'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { schema, runtime, state, selectNode, hoverNode, insertMaterial } = ctx

const wrapNode = computed(() => {
  return (node: PageNode, inner: VNode): VNode => {
    const isSelected = state.selectedNodeId === node.id
    const isHovered = state.hoverNodeId === node.id
    return h(
      'div',
      {
        class: [
          'lc-node',
          isSelected ? 'lc-node--selected' : '',
          isHovered ? 'lc-node--hovered' : '',
        ],
        'data-node-id': node.id,
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          selectNode(node.id)
        },
        onMouseenter: () => hoverNode(node.id),
        onMouseleave: () => hoverNode(null),
      },
      inner,
    )
  }
})

const isEmpty = computed(() => schema.value.nodes.length === 0)

const canvasStyle = computed(() => ({
  width: deviceWidth(state.device) ?? '100%',
}))

function onDrop(event: DragEvent): void {
  const type = event.dataTransfer?.getData('application/x-lc-material')
  if (type) insertMaterial(type)
}
</script>

<template>
  <main class="lc-canvas-wrap">
    <div
      class="lc-canvas"
      :class="{ 'lc-canvas--empty': isEmpty }"
      :style="canvasStyle"
      @click="selectNode(null)"
      @drop="onDrop"
      @dragover.prevent
    >
      <RuntimeRenderer
        v-if="schema && runtime && !isEmpty"
        :schema="schema"
        :context="runtime"
        :wrap-node="wrapNode"
      />
      <div v-if="isEmpty" class="lc-canvas__empty">
        <p class="lc-canvas__empty-title">从左侧拖入或点击组件</p>
        <p class="lc-canvas__empty-sub">开始搭建你的页面</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.lc-canvas-wrap {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: auto;
  background: #f2f3f5;
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.lc-canvas {
  min-height: calc(100vh - 200px);
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: width 0.2s ease;
}
.lc-canvas--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-canvas__empty {
  text-align: center;
  color: #86909c;
}
.lc-canvas__empty-title {
  font-size: 15px;
  color: #4e5969;
  margin: 0 0 8px;
}
.lc-canvas__empty-sub {
  font-size: 13px;
  margin: 0;
}

/* 节点包装层：选中/悬停边框 */
:deep(.lc-node) {
  position: relative;
  border: 1px dashed transparent;
  border-radius: 2px;
  transition: border-color 0.15s ease;
  cursor: pointer;
}
:deep(.lc-node:hover) {
  border-color: #3370ff;
}
:deep(.lc-node--selected) {
  border: 1px solid #3370ff;
}
:deep(.lc-node--selected::after) {
  content: attr(data-node-id);
  position: absolute;
  top: -18px;
  left: -1px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 16px;
  color: #fff;
  background: #3370ff;
  border-radius: 3px 3px 0 0;
  white-space: nowrap;
}
</style>
