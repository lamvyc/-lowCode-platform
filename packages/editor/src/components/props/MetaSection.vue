<script setup lang="ts">
import { ElButton, ElSwitch } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import InputControl from '../controls/InputControl.vue'
import { useEditorStore } from '../../store/editor'

const props = defineProps<{ node: PageNode }>()
const store = useEditorStore()

function metaLabel(): string {
  return props.node.meta?.label ?? ''
}

function setMetaLabel(value: string) {
  store.updateNode(props.node.id, (node) => ({
    ...node,
    meta: { ...(node.meta ?? {}), label: value },
  }))
}

function setMetaLocked(value: boolean) {
  store.updateNode(props.node.id, (node) => ({
    ...node,
    meta: { ...(node.meta ?? {}), locked: value },
  }))
}

function setMetaHidden(value: boolean) {
  store.updateNode(props.node.id, (node) => ({
    ...node,
    meta: { ...(node.meta ?? {}), hidden: value },
  }))
}
</script>

<template>
  <div class="lc-panel__title">节点</div>
  <div class="lc-props-row">
    <span class="lc-props-row__label">标签</span>
    <div class="lc-props-row__control">
      <InputControl :model-value="metaLabel()" @update:model-value="setMetaLabel" />
    </div>
  </div>
  <div class="lc-props-row">
    <span class="lc-props-row__label">锁定</span>
    <div class="lc-props-row__control">
      <ElSwitch
        :model-value="Boolean(props.node.meta?.locked)"
        size="small"
        @update:model-value="(value: string | number | boolean) => setMetaLocked(Boolean(value))"
      />
    </div>
  </div>
  <div class="lc-props-row">
    <span class="lc-props-row__label">隐藏</span>
    <div class="lc-props-row__control">
      <ElSwitch
        :model-value="Boolean(props.node.meta?.hidden)"
        size="small"
        @update:model-value="(value: string | number | boolean) => setMetaHidden(Boolean(value))"
      />
    </div>
  </div>
  <div style="padding: 8px 12px">
    <ElButton type="danger" size="small" @click="store.removeNodes([props.node.id])">
      删除节点
    </ElButton>
  </div>
</template>
