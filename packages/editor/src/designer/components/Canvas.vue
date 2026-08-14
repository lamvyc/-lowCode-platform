<script setup lang="ts">
import {
  computed,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type VNode,
} from 'vue'
import type { PageNode } from '@lowcode/schema'
import { RuntimeRenderer } from '@lowcode/runtime'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { DEVICE_BORDER, deviceDimension } from '../device'

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

const dimension = computed(() => deviceDimension(state.device))

/** 设备总尺寸（含边框） */
const totalSize = computed(() => {
  const d = dimension.value
  if (!d) return null
  return { width: d.width + DEVICE_BORDER * 2, height: d.height + DEVICE_BORDER * 2 }
})

/** 缩放：工作区小于设备时等比例缩小 */
const wrapRef = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | null = null

function updateScale(): void {
  const el = wrapRef.value
  const total = totalSize.value
  if (!el || !total) {
    scale.value = 1
    return
  }
  const availW = el.clientWidth - 48
  const availH = el.clientHeight - 48
  scale.value = Math.max(0.2, Math.min(1, availW / total.width, availH / total.height))
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(updateScale)
    if (wrapRef.value) observer.observe(wrapRef.value)
  }
  updateScale()
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => state.device, updateScale)

/** 缩放容器布局尺寸（= 设备总尺寸 × scale） */
const viewportStyle = computed(() => {
  const total = totalSize.value
  if (!total) return {}
  return { width: `${total.width * scale.value}px`, height: `${total.height * scale.value}px` }
})

/** 设备画布样式（固定尺寸 + 等比缩放） */
const deviceStyle = computed(() => {
  const total = totalSize.value
  if (!total) return {}
  return {
    width: `${total.width}px`,
    height: `${total.height}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: 'top left',
  }
})

function onDrop(event: DragEvent): void {
  const type = event.dataTransfer?.getData('application/x-lc-material')
  if (type) insertMaterial(type)
}
</script>

<template>
  <main
    ref="wrapRef"
    class="lc-canvas-wrap"
    :class="`lc-canvas-wrap--${state.device}`"
  >
    <!-- PC：白色画布铺满工作区 -->
    <div
      v-if="state.device === 'pc'"
      class="lc-canvas lc-canvas--pc"
      :class="{ 'lc-canvas--empty': isEmpty }"
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

    <!-- Pad / H5：浅灰工作区 + 居中设备画布 + 深灰圆角边框 -->
    <div v-else class="lc-device-viewport" :style="viewportStyle">
      <div
        class="lc-canvas lc-canvas--device"
        :class="{ 'lc-canvas--empty': isEmpty }"
        :style="deviceStyle"
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
    </div>
  </main>
</template>

<style scoped>
.lc-canvas-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  box-sizing: border-box;
}

/* PC：画布铺满，无边框 */
.lc-canvas-wrap--pc {
  padding: 0;
  background: #fff;
}

/* Pad / H5：浅灰工作区 + 内边距 */
.lc-canvas-wrap--pad,
.lc-canvas-wrap--h5 {
  padding: 24px;
  background: #f2f3f5;
}

.lc-canvas {
  background: #fff;
  box-sizing: border-box;
}

.lc-canvas--pc {
  width: 100%;
  height: 100%;
  overflow: auto;
  border: none;
  border-radius: 0;
}

.lc-canvas--device {
  overflow: auto;
  border: 10px solid #3c4043;
  border-radius: 22px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

.lc-device-viewport {
  margin: auto;
  flex-shrink: 0;
  overflow: hidden;
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
