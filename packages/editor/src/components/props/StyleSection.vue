<script setup lang="ts">
import { computed } from 'vue'
import type { Binding, PageNode } from '@lowcode/schema'
import MonacoEditor from '../controls/MonacoEditor.vue'
import { useEditorStore } from '../../store/editor'

const props = defineProps<{ node: PageNode }>()
const store = useEditorStore()

const styleText = computed(() => JSON.stringify(props.node.style ?? {}, null, 2))

function onStyleChange(value: string) {
  try {
    store.updateStyle(
      props.node.id,
      JSON.parse(value) as Record<string, Binding<string | number>>,
    )
  } catch {
    // 非法 JSON 等待继续编辑
  }
}
</script>

<template>
  <div class="lc-panel__title">样式</div>
  <div style="padding: 8px 12px">
    <MonacoEditor
      :model-value="styleText"
      language="json"
      :height="120"
      @update:model-value="onStyleChange"
    />
  </div>
</template>
