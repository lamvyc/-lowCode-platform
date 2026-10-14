<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ElButton, ElDialog, ElInput, ElMessage } from 'element-plus'
import type { EventAction, MaterialEventConfig, PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'
import ActionChainEditor from './ActionChainEditor.vue'

const props = defineProps<{
  node: PageNode
  eventConfigs?: MaterialEventConfig[]
}>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

interface EventRow {
  name: string
  label: string
  params: string[]
  description?: string
}

/** 已声明事件 + 节点上额外的自定义事件 */
const rows = computed<EventRow[]>(() => {
  const declared: EventRow[] = (props.eventConfigs ?? []).map((config) => ({
    name: config.name,
    label: config.label ?? config.name,
    params: config.params ?? [],
    description: config.description,
  }))
  const declaredNames = new Set(declared.map((row) => row.name))
  const extras: EventRow[] = Object.keys(props.node.events ?? {})
    .filter((name) => !declaredNames.has(name))
    .map((name) => ({ name, label: name, params: [] }))
  return [...declared, ...extras]
})

function actionCount(eventName: string): number {
  return props.node.events?.[eventName]?.length ?? 0
}

const editing = ref<EventRow | null>(null)
const draftActions = ref<EventAction[]>([])
const customName = ref('')

function openEditor(row: EventRow): void {
  editing.value = row
  draftActions.value = JSON.parse(
    JSON.stringify(props.node.events?.[row.name] ?? []),
  ) as EventAction[]
}

function closeEditor(): void {
  editing.value = null
  draftActions.value = []
}

/** 写回动作链：空链视为取消该事件绑定 */
function saveEditor(): void {
  const row = editing.value
  if (!row) return
  const next = { ...(props.node.events ?? {}) }
  if (draftActions.value.length === 0) delete next[row.name]
  else next[row.name] = draftActions.value
  ctx.updateNodeEvents(props.node.id, Object.keys(next).length > 0 ? next : undefined)
  closeEditor()
}

function clearEvent(row: EventRow): void {
  const next = { ...(props.node.events ?? {}) }
  delete next[row.name]
  ctx.updateNodeEvents(props.node.id, Object.keys(next).length > 0 ? next : undefined)
}

function addCustomEvent(): void {
  const name = customName.value.trim().replace(/^on/, '')
  if (!name) {
    ElMessage.info('请输入事件名，如 click')
    return
  }
  if (rows.value.some((row) => row.name === name)) {
    ElMessage.info(`事件已存在：${name}`)
    return
  }
  customName.value = ''
  openEditor({ name, label: `on${name.charAt(0).toUpperCase()}${name.slice(1)}`, params: [] })
}

const dialogTitle = computed(() =>
  editing.value ? `编辑事件：${editing.value.label}` : '编辑事件',
)
</script>

<template>
  <div class="lc-events">
    <div v-for="row in rows" :key="row.name" class="lc-event">
      <div class="lc-event__main">
        <span class="lc-event__name">{{ row.label }}</span>
        <span v-if="actionCount(row.name) > 0" class="lc-event__badge">
          {{ actionCount(row.name) }} 个动作
        </span>
      </div>
      <p v-if="row.description" class="lc-event__desc">{{ row.description }}</p>
      <div class="lc-event__actions">
        <el-button size="small" type="primary" plain @click="openEditor(row)">
          {{ actionCount(row.name) > 0 ? '编辑动作' : '添加动作' }}
        </el-button>
        <el-button
          v-if="actionCount(row.name) > 0"
          size="small"
          text
          @click="clearEvent(row)"
        >
          清空
        </el-button>
      </div>
    </div>

    <div class="lc-events__custom">
      <el-input
        v-model="customName"
        size="small"
        placeholder="自定义事件名，如 dblclick"
        @keyup.enter="addCustomEvent"
      />
      <el-button size="small" plain @click="addCustomEvent">添加事件</el-button>
    </div>

    <el-dialog
      :model-value="editing !== null"
      :title="dialogTitle"
      width="640px"
      append-to-body
      destroy-on-close
      @update:model-value="(value: boolean) => !value && closeEditor()"
    >
      <ActionChainEditor
        v-if="editing"
        v-model="draftActions"
        :event-name="editing.name"
        :params="editing.params"
        :widget-name="node.name ?? node.id"
      />
      <template #footer>
        <el-button @click="closeEditor">取消</el-button>
        <el-button type="primary" @click="saveEditor">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.lc-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lc-event {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 8px;
  background: #fafbfc;
}
.lc-event__main {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lc-event__name {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #1f2329;
}
.lc-event__badge {
  padding: 0 5px;
  border-radius: 8px;
  background: #e8f3ff;
  color: #3370ff;
  font-size: 11px;
  line-height: 16px;
}
.lc-event__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #86909c;
  line-height: 16px;
}
.lc-event__actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.lc-events__custom {
  display: flex;
  gap: 6px;
}
</style>
