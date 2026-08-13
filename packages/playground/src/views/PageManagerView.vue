<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElTable, ElTableColumn } from 'element-plus'
import { createEmptySchema } from '@lowcode/schema'
import {
  deletePage,
  deleteTemplate,
  listTemplates,
  loadPages,
  savePage,
  saveTemplate,
  templateToPage,
  type StoredPage,
  type StoredTemplate,
} from '../storage'
import { createDemoSchema } from '../demo-schema'

const router = useRouter()
const pages = ref<StoredPage[]>(loadPages())
const templates = ref<StoredTemplate[]>(listTemplates())
const importTemplateInput = ref<HTMLInputElement | null>(null)

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

function useTemplate(template: StoredTemplate) {
  const page = templateToPage(template)
  savePage(page)
  void router.push(`/editor/${page.meta.id}`)
}

function exportTemplate(template: StoredTemplate) {
  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name}.template.json`
  a.click()
  URL.revokeObjectURL(url)
}

function removeTemplate(template: StoredTemplate) {
  deleteTemplate(template.id)
  templates.value = listTemplates()
}

function onImportTemplate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as Partial<StoredTemplate>
      if (!parsed.schema?.version || !Array.isArray(parsed.schema?.nodes)) {
        throw new Error('不是合法的模板文件')
      }
      saveTemplate(parsed.schema, parsed.name ?? '导入模板', parsed.description)
      templates.value = listTemplates()
    } catch (error) {
      window.alert(`导入失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  reader.readAsText(file)
  if (importTemplateInput.value) importTemplateInput.value.value = ''
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

    <h2 style="margin-top: 40px">模板管理</h2>
    <div style="display: flex; gap: 8px; margin-bottom: 16px">
      <ElButton type="primary" @click="importTemplateInput?.click()">导入模板</ElButton>
      <input
        ref="importTemplateInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="onImportTemplate"
      />
      <span style="font-size: 12px; color: #86909c; align-self: center">
        在编辑器中点击「保存为模板」即可生成模板
      </span>
    </div>
    <ElTable :data="templates" stripe>
      <ElTableColumn prop="name" label="模板名称" />
      <ElTableColumn prop="createdAt" label="创建时间" width="220" />
      <ElTableColumn label="操作" width="260">
        <template #default="{ row }">
          <ElButton size="small" type="primary" @click="useTemplate(row as StoredTemplate)">
            使用
          </ElButton>
          <ElButton size="small" @click="exportTemplate(row as StoredTemplate)">导出</ElButton>
          <ElButton size="small" type="danger" @click="removeTemplate(row as StoredTemplate)">
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>
