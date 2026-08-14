<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MaterialRegistryResolver, RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import {
  actionRegistry,
  expressionEngine,
  initPlatform,
  materialRegistry,
} from '@lowcode/editor'
import { createDemoSchema } from './demo-schema'

initPlatform()

const schema = createDemoSchema()
const runtime = ref<RuntimeContext | null>(null)

onMounted(() => {
  runtime.value = new RuntimeContext({
    schema,
    resolver: new MaterialRegistryResolver(materialRegistry),
    actionRegistry,
    expression: expressionEngine,
    storage: window.localStorage,
  })
  void runtime.value.init()
})
</script>

<template>
  <main style="max-width: 720px; margin: 0 auto; padding: 24px; background: #fff; min-height: 100vh">
    <h1>低代码平台基建验证</h1>
    <p style="color: #86909c">
      当前仅保留 Schema / Core / Runtime / Materials 与纯 EditorEngine 基建，
      旧页面构建器交互层已移除。
    </p>
    <RuntimeRenderer v-if="runtime" :schema="runtime.schema" :context="runtime" />
  </main>
</template>
