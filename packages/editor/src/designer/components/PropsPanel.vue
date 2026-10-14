<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { ElEmpty } from 'element-plus'
import { extractCssClassNames } from '@lowcode/schema'
import { materialRegistry } from '../../platform'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { useFormCss } from '../form-css'
import ComponentSettings from './props/ComponentSettings.vue'
import FormSettings from './props/FormSettings.vue'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { selectedNode, schema, state, formSettings } = ctx

type SettingTab = 'component' | 'form' | 'datasource'

const TABS: ReadonlyArray<{ key: SettingTab; label: string }> = [
  { key: 'component', label: '组件设置' },
  { key: 'form', label: '表单设置' },
  { key: 'datasource', label: '数据源' },
]

const activeTab = ref<SettingTab>('form')

const material = computed(() =>
  selectedNode.value ? materialRegistry.get(selectedNode.value.type) : undefined,
)

/** 表单自定义 CSS 中提取出的类名，供组件「自定义类名」下拉复用 */
const customClasses = computed(() => extractCssClassNames(formSettings.value.cssCode))

// 表单 CSS 注入画布（与运行时 head 注入保持一致）
useFormCss(computed(() => formSettings.value.cssCode))

// 选中组件时自动切到「组件设置」，取消选中时回到「表单设置」
watch(
  () => state.selectedNodeId,
  (id) => {
    if (id) activeTab.value = 'component'
    else if (activeTab.value === 'component') activeTab.value = 'form'
  },
)
</script>

<template>
  <aside class="lc-props-panel">
    <div class="lc-props-panel__tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="lc-props-panel__body">
      <template v-if="activeTab === 'component'">
        <el-empty
          v-if="!selectedNode"
          description="选中画布中的组件进行配置"
          :image-size="72"
        />
        <template v-else>
          <div class="lc-props-panel__title">
            <span class="lc-props-panel__name">{{ material?.name ?? selectedNode.type }}</span>
            <code class="lc-props-panel__code">{{ selectedNode.name ?? selectedNode.id }}</code>
          </div>
          <div class="lc-props-panel__content">
            <ComponentSettings
              :key="selectedNode.id"
              :node="selectedNode"
              :material="material"
              :custom-classes="customClasses"
            />
          </div>
        </template>
      </template>

      <template v-else-if="activeTab === 'form'">
        <div class="lc-props-panel__title">
          <span class="lc-props-panel__name">表单设置</span>
          <code class="lc-props-panel__code">{{ schema.meta.name }}</code>
        </div>
        <div class="lc-props-panel__content">
          <FormSettings />
        </div>
      </template>

      <template v-else>
        <el-empty description="数据源管理即将上线" :image-size="72" />
      </template>
    </div>
  </aside>
</template>

<style scoped>
.lc-props-panel {
  display: flex;
  flex-direction: column;
  width: 300px;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.lc-props-panel__tabs {
  display: flex;
  border-bottom: 1px solid #e5e6eb;
}
.lc-tab {
  flex: 1;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #4e5969;
}
.lc-tab--active {
  color: #3370ff;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 #3370ff;
}
.lc-props-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.lc-props-panel__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
}
.lc-props-panel__name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.lc-props-panel__code {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  color: #86909c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-props-panel__content {
  padding: 4px 12px 24px;
}
</style>
