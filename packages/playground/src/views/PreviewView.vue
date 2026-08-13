<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import { MaterialRegistryResolver, RuntimeContext, RuntimeRenderer } from '@lowcode/runtime'
import {
  actionRegistry,
  expressionEngine,
  initPlatform,
  materialRegistry,
} from '@lowcode/editor'
import { getPage } from '../storage'

const route = useRoute()
const router = useRouter()
const runtime = ref<RuntimeContext | null>(null)
const title = ref('')

onMounted(() => {
  initPlatform()
  const page = getPage(String(route.params.id))
  if (!page) {
    void router.replace('/')
    return
  }
  title.value = page.name
  runtime.value = new RuntimeContext({
    schema: page.schema,
    resolver: new MaterialRegistryResolver(materialRegistry),
    actionRegistry,
    expression: expressionEngine,
    storage: window.localStorage,
  })
  void runtime.value.init()
})
</script>

<template>
  <div style="min-height: 100vh; background: #fff">
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        border-bottom: 1px solid #e5e6eb;
      "
    >
      <strong>{{ title }}</strong>
      <ElButton size="small" @click="router.push('/')">返回列表</ElButton>
    </div>
    <div style="padding: 24px; max-width: 720px; margin: 0 auto">
      <RuntimeRenderer v-if="runtime" :schema="runtime.schema" :context="runtime" />
    </div>
  </div>
</template>
