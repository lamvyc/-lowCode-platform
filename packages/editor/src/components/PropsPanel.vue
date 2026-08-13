<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElInput, ElSwitch } from 'element-plus'
import { isExpressionBinding } from '@lowcode/schema'
import type { Binding, EventAction } from '@lowcode/schema'
import { materialRegistry } from '../platform'
import { useEditorStore } from '../store/editor'
import ColorControl from './controls/ColorControl.vue'
import ExpressionControl from './controls/ExpressionControl.vue'
import InputControl from './controls/InputControl.vue'
import JsonControl from './controls/JsonControl.vue'
import MonacoEditor from './controls/MonacoEditor.vue'
import NumberControl from './controls/NumberControl.vue'
import SelectControl from './controls/SelectControl.vue'
import SwitchControl from './controls/SwitchControl.vue'

const store = useEditorStore()
const node = computed(() => store.selectedNode)
const material = computed(() => (node.value ? materialRegistry.get(node.value.type) : undefined))

const CONTROL_COMPONENTS = {
  input: InputControl,
  number: NumberControl,
  select: SelectControl,
  switch: SwitchControl,
  color: ColorControl,
}

function rawProp(name: string): unknown {
  return node.value?.props[name]
}

function isExpr(name: string): boolean {
  return isExpressionBinding(rawProp(name))
}

function setPropValue(name: string, value: unknown) {
  if (!node.value) return
  store.updateProps(node.value.id, { [name]: value })
}

function setExprValue(name: string, value: string) {
  setPropValue(name, { type: 'expression', value })
}

function toggleBinding(name: string) {
  const current = rawProp(name)
  if (isExpressionBinding(current)) {
    setPropValue(name, { type: 'static', value: current.value })
  } else {
    setPropValue(name, {
      type: 'expression',
      value: typeof current === 'string' ? current : '',
    })
  }
}

function expressionOf(name: string): string {
  const value = rawProp(name)
  if (isExpressionBinding(value)) return String(value.value)
  if (typeof value === 'string') return value
  return value === undefined ? '' : JSON.stringify(value)
}

// 绑定（visible / loop）
const visibleBinding = computed(() => node.value?.bindings?.visible)
const visibleExpr = computed(() =>
  isExpressionBinding(visibleBinding.value) ? String(visibleBinding.value.value) : 'true',
)
function setVisibleExpr(value: string) {
  if (!node.value) return
  store.updateBinding(node.value.id, 'visible', { type: 'expression', value })
}
function toggleVisibleStatic() {
  if (!node.value) return
  if (isExpressionBinding(visibleBinding.value)) {
    store.updateBinding(node.value.id, 'visible', { type: 'static', value: true })
  } else {
    store.updateBinding(node.value.id, 'visible', {
      type: 'expression',
      value: visibleBinding.value && 'value' in visibleBinding.value
        ? String(visibleBinding.value.value)
        : 'true',
    })
  }
}

// 样式
const styleText = computed(() => JSON.stringify(node.value?.style ?? {}, null, 2))
function onStyleChange(value: string) {
  if (!node.value) return
  try {
    store.updateStyle(node.value.id, JSON.parse(value) as Record<string, Binding<string | number>>)
  } catch {
    // 非法 JSON 等待继续编辑
  }
}

// 事件
const events = computed(() => node.value?.events ?? {})
const eventNames = computed(() => Object.keys(events.value))
const newEventName = ref('click')
function addEvent() {
  if (!node.value) return
  const name = newEventName.value.trim()
  if (!name || events.value[name]) return
  store.updateEvents(node.value.id, { ...events.value, [name]: [] })
}
function removeEvent(name: string) {
  if (!node.value) return
  const next = { ...events.value }
  delete next[name]
  store.updateEvents(node.value.id, next)
}
function onEventActionsChange(name: string, value: string) {
  if (!node.value) return
  try {
    store.updateEvents(node.value.id, {
      ...events.value,
      [name]: JSON.parse(value) as EventAction[],
    })
  } catch {
    // 等待合法 JSON
  }
}

function metaLabel(): string {
  return node.value?.meta?.label ?? ''
}
function setMetaLabel(value: string) {
  if (!node.value) return
  store.updateNode(node.value.id, (n) => ({ ...n, meta: { ...(n.meta ?? {}), label: value } }))
}
function setMetaLocked(value: boolean) {
  if (!node.value) return
  store.updateNode(node.value.id, (n) => ({ ...n, meta: { ...(n.meta ?? {}), locked: value } }))
}
function setMetaHidden(value: boolean) {
  if (!node.value) return
  store.updateNode(node.value.id, (n) => ({ ...n, meta: { ...(n.meta ?? {}), hidden: value } }))
}
</script>

<template>
  <aside class="lc-panel lc-panel--right">
    <div class="lc-panel__title">属性面板</div>
    <div v-if="!node" class="lc-empty-hint">选中画布中的节点进行配置</div>
    <template v-else>
      <div class="lc-panel__title" style="border-bottom: none">属性</div>
      <div
        v-for="config in material?.propConfigs ?? []"
        :key="config.name"
        class="lc-props-row"
      >
        <span class="lc-props-row__label">{{ config.label }}</span>
        <div class="lc-props-row__control">
          <ExpressionControl
            v-if="isExpr(config.name) || config.control === 'expression'"
            :model-value="expressionOf(config.name)"
            @update:model-value="setExprValue(config.name, $event)"
          />
          <JsonControl
            v-else-if="config.control === 'json'"
            :model-value="rawProp(config.name)"
            @update:model-value="setPropValue(config.name, $event)"
          />
          <component
            :is="CONTROL_COMPONENTS[config.control as keyof typeof CONTROL_COMPONENTS] ?? InputControl"
            v-else
            :model-value="rawProp(config.name)"
            :options="config.options ?? []"
            @update:model-value="setPropValue(config.name, $event)"
          />
        </div>
        <button
          v-if="config.control !== 'expression'"
          class="lc-fx-btn"
          :class="{ 'lc-fx-btn--active': isExpr(config.name) }"
          title="切换静态值 / 表达式"
          @click="toggleBinding(config.name)"
        >
          fx
        </button>
      </div>

      <div class="lc-panel__title">绑定</div>
      <div class="lc-props-row">
        <span class="lc-props-row__label">可见性</span>
        <div class="lc-props-row__control">
          <ExpressionControl :model-value="visibleExpr" @update:model-value="setVisibleExpr" />
        </div>
        <button class="lc-fx-btn" title="切换静态 / 表达式" @click="toggleVisibleStatic">fx</button>
      </div>

      <div class="lc-panel__title">样式</div>
      <div style="padding: 8px 12px">
        <MonacoEditor
          :model-value="styleText"
          language="json"
          :height="120"
          @update:model-value="onStyleChange"
        />
      </div>

      <div class="lc-panel__title">事件</div>
      <div style="padding: 8px 12px">
        <div v-for="name in eventNames" :key="name" style="margin-bottom: 8px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-size: 13px; font-weight: 600">@{{ name }}</span>
            <button class="lc-fx-btn" @click="removeEvent(name)">删除</button>
          </div>
          <MonacoEditor
            :model-value="JSON.stringify(events[name] ?? [], null, 2)"
            language="json"
            :height="100"
            @update:model-value="onEventActionsChange(name, $event)"
          />
        </div>
        <div style="display: flex; gap: 6px">
          <ElInput v-model="newEventName" size="small" placeholder="事件名" />
          <ElButton size="small" type="primary" @click="addEvent">添加事件</ElButton>
        </div>
      </div>

      <div class="lc-panel__title">节点</div>
      <div class="lc-props-row">
        <span class="lc-props-row__label">标签</span>
        <div class="lc-props-row__control">
          <InputControl :model-value="metaLabel()" @update:model-value="setMetaLabel" />
        </div>
      </div>
      <div class="lc-props-row">
        <span class="lc-props-row__label">锁定</span>
        <div class="lc-props-row__control">
          <ElSwitch
            :model-value="Boolean(node.meta?.locked)"
            size="small"
            @update:model-value="(value: string | number | boolean) => setMetaLocked(Boolean(value))"
          />
        </div>
      </div>
      <div class="lc-props-row">
        <span class="lc-props-row__label">隐藏</span>
        <div class="lc-props-row__control">
          <ElSwitch
            :model-value="Boolean(node.meta?.hidden)"
            size="small"
            @update:model-value="(value: string | number | boolean) => setMetaHidden(Boolean(value))"
          />
        </div>
      </div>
      <div style="padding: 8px 12px">
        <ElButton type="danger" size="small" @click="store.removeNodes([node.id])">
          删除节点
        </ElButton>
      </div>
    </template>
  </aside>
</template>
