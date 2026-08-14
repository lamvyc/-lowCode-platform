<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElInput } from 'element-plus'
import type { EventAction, PageNode } from '@lowcode/schema'
import MonacoEditor from '../controls/MonacoEditor.vue'
import { useEditorStore } from '../../store/editor'

const props = defineProps<{ node: PageNode }>()
const store = useEditorStore()
const events = computed(() => props.node.events ?? {})
const eventNames = computed(() => Object.keys(events.value))
const newEventName = ref('click')

function addEvent() {
  const name = newEventName.value.trim()
  if (!name || events.value[name]) return
  store.updateEvents(props.node.id, { ...events.value, [name]: [] })
}

function removeEvent(name: string) {
  const next = { ...events.value }
  delete next[name]
  store.updateEvents(props.node.id, next)
}

function onEventActionsChange(name: string, value: string) {
  try {
    store.updateEvents(props.node.id, {
      ...events.value,
      [name]: JSON.parse(value) as EventAction[],
    })
  } catch {
    // 等待合法 JSON
  }
}
</script>

<template>
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
</template>
