<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ElEmpty, ElInput } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import type { Material } from '@lowcode/schema'
import { materialRegistry } from '../../platform'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { setDragState, setDropTarget } = ctx

const activeTab = ref<'components' | 'templates'>('components')
const keyword = ref('')
const collapsed = ref<Set<string>>(new Set())

const groups = computed(() => {
  const materials = materialRegistry.list()
  const filtered = keyword.value
    ? materials.filter(
        (m) => m.name.includes(keyword.value) || m.type.includes(keyword.value),
      )
    : materials
  const map = new Map<string, Material[]>()
  for (const material of filtered) {
    const key = material.category || '其他'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(material)
  }
  return [...map.entries()]
})

function toggleGroup(category: string): void {
  const next = new Set(collapsed.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  collapsed.value = next
}

function isCollapsed(category: string): boolean {
  return collapsed.value.has(category)
}

function addMaterial(material: Material): void {
  ctx.insertMaterial(material.type)
}

function onDragStart(event: DragEvent, material: Material): void {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/x-lc-material', material.type)
    event.dataTransfer.effectAllowed = 'copy'
  }
  setDragState({ source: 'material', materialType: material.type })
}

function onDragEnd(): void {
  setDragState(null)
  setDropTarget(null)
}
</script>

<template>
  <aside class="lc-material-panel">
    <div class="lc-material-panel__tabs">
      <button
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === 'components' }"
        @click="activeTab = 'components'"
      >
        组件库
      </button>
      <button
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === 'templates' }"
        @click="activeTab = 'templates'"
      >
        页面模板
      </button>
    </div>

    <template v-if="activeTab === 'components'">
      <div class="lc-material-panel__search">
        <el-input v-model="keyword" placeholder="搜索组件" :prefix-icon="Search" clearable />
      </div>

      <div class="lc-material-panel__list">
        <div v-for="[category, materials] in groups" :key="category" class="lc-group">
          <button class="lc-group__header" @click="toggleGroup(category)">
            <span class="lc-group__arrow">{{ isCollapsed(category) ? '▸' : '▾' }}</span>
            <span>{{ category }}</span>
          </button>
          <div v-show="!isCollapsed(category)" class="lc-group__items">
            <div
              v-for="material in materials"
              :key="material.type"
              class="lc-material-item"
              draggable="true"
              @click="addMaterial(material)"
              @dragstart="onDragStart($event, material)"
              @dragend="onDragEnd"
            >
              <span class="lc-material-item__icon">{{ material.icon ?? '◇' }}</span>
              <span class="lc-material-item__name">{{ material.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <el-empty description="模板功能即将上线" />
    </template>
  </aside>
</template>

<style scoped>
.lc-material-panel {
  display: flex;
  flex-direction: column;
  width: 240px;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.lc-material-panel__tabs {
  display: flex;
  border-bottom: 1px solid #e5e6eb;
}
.lc-tab {
  flex: 1;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: #4e5969;
}
.lc-tab--active {
  color: #3370ff;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 #3370ff;
}
.lc-material-panel__search {
  padding: 10px 12px;
}
.lc-material-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}
.lc-group__header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  padding: 0 8px;
}
.lc-group__arrow {
  font-size: 11px;
  color: #86909c;
}
.lc-group__items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px 4px 8px;
}
.lc-material-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  cursor: grab;
  font-size: 13px;
  color: #4e5969;
  user-select: none;
}
.lc-material-item:hover {
  border-color: #3370ff;
  color: #3370ff;
  background: #f5f8ff;
}
.lc-material-item__icon {
  font-size: 14px;
}
.lc-material-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
