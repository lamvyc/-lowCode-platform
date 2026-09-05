<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  ElColorPicker,
  ElEmpty,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus'
import type { PageNode, PropConfig } from '@lowcode/schema'
import { materialRegistry } from '../../platform'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { selectedNode, schema, updateProps, updateNode } = ctx

const activeTab = ref<'component' | 'global' | 'datasource'>('component')

const material = computed(() => {
  const node = selectedNode.value
  return node ? materialRegistry.get(node.type) : undefined
})

const propConfigs = computed(() => material.value?.propConfigs ?? [])

function valueOf(node: PageNode, config: PropConfig): unknown {
  return node.props[config.name]
}

function setValue(node: PageNode, config: PropConfig, value: unknown): void {
  updateProps(node.id, { [config.name]: value })
}

function jsonPreview(value: unknown): string {
  return value === undefined || value === null ? '' : JSON.stringify(value, null, 2)
}

function applyJson(node: PageNode, config: PropConfig, text: string): void {
  try {
    setValue(node, config, text.trim() ? JSON.parse(text) : undefined)
  } catch {
    // 非法 JSON 忽略，保持原值
  }
}

/** 读取节点展示名：优先 name，缺省回退到 id（旧 schema 兼容） */
function nameOf(node: PageNode): string {
  return node.name ?? node.id
}

function stylePreview(node: PageNode): string {
  const style = node.style
  return !style || Object.keys(style).length === 0 ? '' : JSON.stringify(style, null, 2)
}

function applyStyle(node: PageNode, text: string): void {
  try {
    const parsed = text.trim() ? JSON.parse(text) : {}
    updateNode(node.id, (n) => ({ ...n, style: parsed as PageNode['style'] }))
  } catch {
    // 非法 JSON 忽略，保持原值
  }
}

/** 修改唯一名称：全局校验唯一性，重复时禁止修改并提示 */
function applyName(node: PageNode, value: string): void {
  const next = value.trim()
  const current = nameOf(node)
  if (!next || next === current) return
  const duplicated = schema.value.nodes.some(
    (n) => n.id !== node.id && (n.name ?? n.id) === next,
  )
  if (duplicated) {
    ElMessage.error(`组件名称已存在：${next}`)
    return
  }
  // label 与 name 独立维护：仅当 label 仍等于旧 name（未自定义过）时跟随新 name
  const label = node.props.label
  const nextProps =
    typeof label === 'string' && label === current
      ? { ...node.props, label: next }
      : node.props
  updateNode(node.id, (n) => ({ ...n, name: next, props: nextProps }))
}

function applyLabel(node: PageNode, value: string): void {
  updateProps(node.id, { label: value })
}

function applyHidden(node: PageNode, value: boolean): void {
  updateNode(node.id, (n) => ({ ...n, meta: { ...(n.meta ?? {}), hidden: value } }))
}
</script>

<template>
  <aside class="lc-props-panel">
    <div class="lc-props-panel__tabs">
      <button
        v-for="tab in (['component', 'global', 'datasource'] as const)"
        :key="tab"
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ { component: '组件设置', global: '全局设置', datasource: '数据源' }[tab] }}
      </button>
    </div>

    <div class="lc-props-panel__body">
      <template v-if="activeTab === 'component'">
        <el-empty v-if="!selectedNode" description="选中画布中的组件进行配置" />
        <template v-else>
          <div class="lc-props-panel__title">
            {{ material?.name ?? selectedNode.type }}
          </div>
          <div class="lc-props-panel__fields">
            <div v-for="config in propConfigs" :key="config.name" class="lc-field">
              <label class="lc-field__label">{{ config.label }}</label>

              <el-input
                v-if="config.control === 'input'"
                :model-value="String(valueOf(selectedNode, config) ?? '')"
                @update:model-value="(v: string) => setValue(selectedNode!, config, v)"
              />

              <el-input
                v-else-if="config.control === 'name'"
                :model-value="nameOf(selectedNode)"
                placeholder="组件唯一名称"
                @change="(v: string) => applyName(selectedNode!, v)"
              />

              <el-input
                v-else-if="config.control === 'label'"
                :model-value="String(valueOf(selectedNode, config) ?? '')"
                placeholder="组件标签"
                @update:model-value="(v: string) => applyLabel(selectedNode!, v)"
              />

              <el-switch
                v-else-if="config.control === 'hidden'"
                :model-value="Boolean(selectedNode.meta?.hidden)"
                @update:model-value="(v: string | number | boolean) => applyHidden(selectedNode!, Boolean(v))"
              />

              <el-input
                v-else-if="config.control === 'style'"
                type="textarea"
                :rows="6"
                :model-value="stylePreview(selectedNode)"
                placeholder='如 {"borderRadius": "8px"}'
                @change="(v: string) => applyStyle(selectedNode!, v)"
              />

              <el-input-number
                v-else-if="config.control === 'number'"
                :model-value="Number(valueOf(selectedNode, config) ?? 0)"
                :controls="false"
                style="width: 100%"
                @update:model-value="(v: number | undefined) => setValue(selectedNode!, config, v)"
              />

              <el-select
                v-else-if="config.control === 'select'"
                :model-value="String(valueOf(selectedNode, config) ?? '')"
                style="width: 100%"
                @update:model-value="(v: string) => setValue(selectedNode!, config, v)"
              >
                <el-option
                  v-for="opt in config.options ?? []"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>

              <el-switch
                v-else-if="config.control === 'switch'"
                :model-value="Boolean(valueOf(selectedNode, config))"
                @update:model-value="(v: string | number | boolean) => setValue(selectedNode!, config, Boolean(v))"
              />

              <el-color-picker
                v-else-if="config.control === 'color'"
                :model-value="String(valueOf(selectedNode, config) ?? '')"
                @update:model-value="(v: string | null) => setValue(selectedNode!, config, v ?? '')"
              />

              <el-input
                v-else-if="config.control === 'json'"
                type="textarea"
                :rows="6"
                :model-value="jsonPreview(valueOf(selectedNode, config))"
                @change="(v: string) => applyJson(selectedNode!, config, v)"
              />

              <span v-else class="lc-field__todo">{{ config.control }} 控件待支持</span>
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="activeTab === 'global'">
        <el-empty description="全局设置即将上线" />
      </template>

      <template v-else>
        <el-empty description="数据源管理即将上线" />
      </template>
    </div>
  </aside>
</template>

<style scoped>
.lc-props-panel {
  display: flex;
  flex-direction: column;
  width: 280px;
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
  overflow-y: auto;
}
.lc-props-panel__title {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  border-bottom: 1px solid #f2f3f5;
}
.lc-props-panel__fields {
  padding: 8px 16px 24px;
}
.lc-field {
  margin-bottom: 12px;
}
.lc-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #4e5969;
}
.lc-field__todo {
  display: inline-block;
  padding: 4px 8px;
  font-size: 12px;
  color: #86909c;
  background: #f2f3f5;
  border-radius: 4px;
}
</style>
