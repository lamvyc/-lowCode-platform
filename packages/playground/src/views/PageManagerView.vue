<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElTable, ElTableColumn } from 'element-plus'
import { createEmptySchema } from '@lowcode/schema'
import { deletePage, loadPages, savePage, type StoredPage } from '../storage'
import { createDemoSchema } from '../demo-schema'

const router = useRouter()
const pages = ref<StoredPage[]>(loadPages())

const sorted = computed(() =>
  [...pages.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)

function createPage() {
  const schema = createEmptySchema({
    id: `page_${Date.now().toString(36)}`,
    name: '新页面',
  })
  const stored = savePage(schema)
  void router.push(`/editor/${stored.id}`)
}

function createDemo() {
  const schema = createDemoSchema()
  const stored = savePage(schema)
  void router.push(`/editor/${stored.id}`)
}

function removePage(page: StoredPage) {
  deletePage(page.id)
  pages.value = loadPages()
}
</script>

<template>
  <div style="max-width: 860px; margin: 0 auto; padding: 32px 16px">
    <h2>页面管理</h2>
    <div style="display: flex; gap: 8px; margin-bottom: 16px">
      <ElButton type="primary" @click="createPage">新建页面</ElButton>
      <ElButton @click="createDemo">载入演示页面</ElButton>
    </div>
    <ElTable :data="sorted" stripe>
      <ElTableColumn prop="name" label="页面名称" />
      <ElTableColumn prop="updatedAt" label="更新时间" width="220" />
      <ElTableColumn label="操作" width="260">
        <template #default="{ row }">
          <ElButton size="small" @click="router.push(`/editor/${row.id}`)">编辑</ElButton>
          <ElButton size="small" @click="router.push(`/preview/${row.id}`)">预览</ElButton>
          <ElButton size="small" type="danger" @click="removePage(row as StoredPage)">
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>
