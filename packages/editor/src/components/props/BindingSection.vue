<script setup lang="ts">
import { computed } from 'vue'
import { isExpressionBinding } from '@lowcode/schema'
import type { PageNode } from '@lowcode/schema'
import ExpressionControl from '../controls/ExpressionControl.vue'
import { useEditorStore } from '../../store/editor'

const props = defineProps<{ node: PageNode }>()
const store = useEditorStore()

const visibleBinding = computed(() => props.node.bindings?.visible)
const visibleExpr = computed(() =>
  isExpressionBinding(visibleBinding.value) ? String(visibleBinding.value.value) : 'true',
)

function setVisibleExpr(value: string) {
  store.updateBinding(props.node.id, 'visible', { type: 'expression', value })
}

function toggleVisibleStatic() {
  if (isExpressionBinding(visibleBinding.value)) {
    store.updateBinding(props.node.id, 'visible', { type: 'static', value: true })
  } else {
    store.updateBinding(props.node.id, 'visible', {
      type: 'expression',
      value: visibleBinding.value && 'value' in visibleBinding.value
        ? String(visibleBinding.value.value)
        : 'true',
    })
  }
}
</script>

<template>
  <div class="lc-panel__title">绑定</div>
  <div class="lc-props-row">
    <span class="lc-props-row__label">可见性</span>
    <div class="lc-props-row__control">
      <ExpressionControl :model-value="visibleExpr" @update:model-value="setVisibleExpr" />
    </div>
    <button class="lc-fx-btn" title="切换静态 / 表达式" @click="toggleVisibleStatic">fx</button>
  </div>
</template>
