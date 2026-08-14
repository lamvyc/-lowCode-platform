<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
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
// shallowRef：RuntimeContext 自持内部 reactive 状态，无需深度代理（避免类私有字段被 UnwrapRef 破坏类型）
const runtime = shallowRef<RuntimeContext | null>(null)

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

    <section style="margin-top: 24px">
      <h2>权限消费端演示（当前用户：demo-admin，角色 admin）</h2>
      <p v-permission="{ resource: 'Order', action: 'update' }" style="color: green">
        ✅ 有 Order 的 update 权限，此内容可见
      </p>
      <p v-permission="{ resource: 'Order', action: 'delete' }" style="color: red">
        ❌ 没有 Order 的 delete 权限，此内容应被移除
      </p>
    </section>
  </main>
</template>
