<script setup lang="ts">
import { computed } from 'vue'
import { isExpressionBinding } from '@lowcode/schema'
import { materialRegistry } from '../platform'
import { useEditorStore } from '../store/editor'
import BindingSection from './props/BindingSection.vue'
import EventSection from './props/EventSection.vue'
import MetaSection from './props/MetaSection.vue'
import PropField from './props/PropField.vue'
import StyleSection from './props/StyleSection.vue'

const store = useEditorStore()
const node = computed(() => store.selectedNode)
const material = computed(() => (node.value ? materialRegistry.get(node.value.type) : undefined))

function rawProp(name: string): unknown {
  return node.value?.props[name]
}

function isExpr(name: string): boolean {
  return isExpressionBinding(rawProp(name))
}

function setPropValue(name: string, value: unknown) {
  if (!node.value) return
  store.updateProps(node.value.id, { [name]: value })
}

function setExprValue(name: string, value: string) {
  setPropValue(name, { type: 'expression', value })
}

function toggleBinding(name: string) {
  const current = rawProp(name)
  if (isExpressionBinding(current)) {
    setPropValue(name, { type: 'static', value: current.value })
  } else {
    setPropValue(name, {
      type: 'expression',
      value: typeof current === 'string' ? current : '',
    })
  }
}

function expressionOf(name: string): string {
  const value = rawProp(name)
  if (isExpressionBinding(value)) return String(value.value)
  if (typeof value === 'string') return value
  return value === undefined ? '' : JSON.stringify(value)
}
</script>

<template>
  <aside class="lc-panel lc-panel--right">
    <div class="lc-panel__title">属性面板</div>
    <div v-if="!node" class="lc-empty-hint">选中画布中的节点进行配置</div>
    <template v-else>
      <div class="lc-panel__title" style="border-bottom: none">属性</div>
      <PropField
        v-for="config in material?.propConfigs ?? []"
        :key="config.name"
        :config="config"
        :value="rawProp(config.name)"
        :is-expression="isExpr(config.name)"
        :expression-value="expressionOf(config.name)"
        @update:value="setPropValue(config.name, $event)"
        @update:expression="setExprValue(config.name, $event)"
        @toggle="toggleBinding(config.name)"
      />
      <BindingSection :node="node" />
      <StyleSection :node="node" />
      <EventSection :node="node" />
      <MetaSection :node="node" />
    </template>
  </aside>
</template>
