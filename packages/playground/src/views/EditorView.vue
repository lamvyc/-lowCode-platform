<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
import { EditorShell, useEditorStore, registerPlugin, initPlatform } from '@lowcode/editor'
import { addVersion, getPage, savePage, saveTemplate } from '../storage'
import { demoPlugin } from '../plugins'

initPlatform()
registerPlugin(demoPlugin)

const route = useRoute()
const router = useRouter()
const store = useEditorStore()

store.saveCallback = async (schema) => {
  savePage(schema)
  addVersion(schema.meta.id, schema)
}

async function saveAsTemplate() {
  if (!store.schema) return
  try {
    const { value } = await ElMessageBox.prompt('模板名称', '保存为模板', {
      inputValue: `${store.schema.meta.name}模板`,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    saveTemplate(store.schema, value)
    ElMessage.success('已保存为模板')
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  const page = getPage(String(route.params.id))
  if (!page) {
    void router.replace('/')
    return
  }
  store.loadSchema(page.schema)
})
</script>

<template>
  <div>
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #fff;
        border-bottom: 1px solid #e5e6eb;
      "
    >
      <span style="font-size: 13px; color: #86909c">
        页面：{{ store.schema?.meta.name ?? '' }}（Ctrl+Z 撤销 / Ctrl+C 复制 / Delete 删除）
      </span>
      <div style="display: flex; gap: 8px">
        <ElButton size="small" @click="saveAsTemplate">保存为模板</ElButton>
        <ElButton size="small" @click="router.push('/')">返回列表</ElButton>
      </div>
    </div>
    <EditorShell />
  </div>
</template>
