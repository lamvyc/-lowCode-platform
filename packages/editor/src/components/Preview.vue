<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'
import { MaterialRegistryResolver, RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import { actionRegistry, expressionEngine, materialRegistry } from '../platform'
import { useEditorStore } from '../store/editor'

const store = useEditorStore()
const runtime = ref<RuntimeContext | null>(null)

onMounted(() => {
  if (!store.schema) return
  runtime.value = new RuntimeContext({
    schema: store.schema,
    resolver: new MaterialRegistryResolver(materialRegistry),
    actionRegistry,
    expression: expressionEngine,
    storage: window.localStorage,
  })
  void runtime.value.init()
})
</script>

<template>
  <main style="flex: 1; overflow: auto; padding: 24px; background: #fff">
    <div style="margin-bottom: 12px">
      <ElButton size="small" @click="store.togglePreview()">返回编辑</ElButton>
      <span style="margin-left: 8px; font-size: 13px; color: #86909c">预览模式</span>
    </div>
    <RuntimeRenderer v-if="runtime && store.schema" :schema="store.schema" :context="runtime" />
  </main>
</template>
