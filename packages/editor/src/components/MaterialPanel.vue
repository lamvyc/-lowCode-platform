<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElInput } from 'element-plus'
import type { RemoteMaterialManifest } from '@lowcode/schema'
import { materialRegistry, remoteMaterialLoader } from '../platform'
import { useEditorStore } from '../store/editor'
import { demoRemoteManifest } from '../demo-remote-manifest'

const store = useEditorStore()
const categories = materialRegistry.categories()
const manifestUrl = ref('')
const loadingRemote = ref(false)
const remoteStatus = ref<{ ok: boolean; text: string } | null>(null)
const remoteMaterials = ref(materialRegistry.list('远程'))

function onDragStart(event: DragEvent, type: string) {
  store.setDragState({ source: 'material', materialType: type })
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

async function loadManifest(manifest: RemoteMaterialManifest) {
  loadingRemote.value = true
  remoteStatus.value = null
  try {
    const result = await remoteMaterialLoader.load(manifest)
    remoteStatus.value = result.ok
      ? { ok: true, text: `已加载 ${result.material.name} v${result.material.version}` }
      : { ok: false, text: `加载失败: ${result.error}` }
  } catch (error) {
    remoteStatus.value = {
      ok: false,
      text: `加载异常: ${error instanceof Error ? error.message : String(error)}`,
    }
  } finally {
    loadingRemote.value = false
    remoteMaterials.value = materialRegistry.list('远程')
  }
}

async function loadFromUrl() {
  const url = manifestUrl.value.trim()
  if (!url) return
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const manifest = (await response.json()) as RemoteMaterialManifest
    await loadManifest(manifest)
  } catch (error) {
    remoteStatus.value = {
      ok: false,
      text: `清单解析失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
</script>

<template>
  <aside class="lc-panel lc-panel--left">
    <div class="lc-panel__title">物料面板</div>
    <div v-for="category in categories" :key="category">
      <div style="padding: 8px 12px 0; font-size: 12px; color: #86909c">{{ category }}</div>
      <div
        v-for="material in materialRegistry.list(category)"
        :key="material.type"
        class="lc-material-item"
        draggable="true"
        @dragstart="onDragStart($event, material.type)"
      >
        <span class="lc-material-item__icon">{{ material.icon }}</span>
        <span>{{ material.name }}</span>
      </div>
    </div>
    <div class="lc-panel__title" style="margin-top: 8px">远程物料</div>
    <div class="lc-remote-row">
      <ElButton
        size="small"
        type="primary"
        :loading="loadingRemote"
        @click="loadManifest(demoRemoteManifest)"
      >
        载入演示
      </ElButton>
    </div>
    <div class="lc-remote-row">
      <ElInput v-model="manifestUrl" size="small" placeholder="manifest JSON 地址" />
      <ElButton size="small" @click="loadFromUrl">加载</ElButton>
    </div>
    <div
      v-if="remoteStatus"
      style="padding: 4px 12px 8px; font-size: 12px"
      :style="{ color: remoteStatus.ok ? '#00b42a' : '#f53f3f' }"
    >
      {{ remoteStatus.text }}
    </div>
    <div v-if="remoteMaterials.length > 0">
      <div
        v-for="material in remoteMaterials"
        :key="material.type"
        class="lc-material-item"
        draggable="true"
        @dragstart="onDragStart($event, material.type)"
      >
        <span class="lc-material-item__icon">{{ material.icon }}</span>
        <span>{{ material.name }}</span>
      </div>
    </div>
  </aside>
</template>
