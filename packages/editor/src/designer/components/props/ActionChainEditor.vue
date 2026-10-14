<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElInput, ElMessage, ElOption, ElSelect } from 'element-plus'
import type { ActionKind, EventAction } from '@lowcode/schema'
import { ACTION_CONFIG_HINTS, ACTION_KIND_OPTIONS, createAction } from '../../props-config'

const props = withDefaults(
  defineProps<{
    modelValue?: EventAction[]
    /** 事件名，用于头部签名提示 */
    eventName?: string
    /** 事件回调参数名 */
    params?: string[]
    /** 组件名称，用于头部签名提示 */
    widgetName?: string
  }>(),
  {
    modelValue: () => [],
    eventName: '',
    params: () => [],
    widgetName: '',
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: EventAction[]): void }>()

const actions = computed<EventAction[]>(() => props.modelValue ?? [])

const signature = computed(() => {
  const params = (props.params ?? []).join(', ')
  return `${props.widgetName || 'widget'}.${props.eventName || 'onEvent'}(${params}) {`
})

function commit(next: EventAction[]): void {
  emit('update:modelValue', next)
}

function patchAction(index: number, patch: Partial<EventAction>): void {
  commit(actions.value.map((action, current) => (current === index ? { ...action, ...patch } : action)))
}

function addAction(): void {
  commit([...actions.value, createAction()])
}

function removeAction(index: number): void {
  commit(actions.value.filter((_, current) => current !== index))
}

function moveAction(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= actions.value.length) return
  const next = [...actions.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  commit(next)
}

function configText(action: EventAction): string {
  return JSON.stringify(action.config ?? {}, null, 2)
}

function configHint(kind: ActionKind): string {
  return ACTION_CONFIG_HINTS[kind] ?? '{}'
}

function setConfig(index: number, text: string): void {
  let parsed: Record<string, unknown>
  try {
    parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    ElMessage.error('动作参数必须是合法 JSON')
    return
  }
  patchAction(index, { config: parsed })
}

function setDelay(index: number, value: number | undefined): void {
  patchAction(index, { delay: value && value > 0 ? value : undefined })
}
</script>

<template>
  <div class="lc-action-chain">
    <div class="lc-action-chain__signature">{{ signature }}</div>

    <div v-if="actions.length === 0" class="lc-action-chain__empty">
      暂无动作，点击「添加动作」构建事件动作链
    </div>

    <div v-for="(action, index) in actions" :key="action.id ?? index" class="lc-action">
      <div class="lc-action__head">
        <span class="lc-action__index">{{ index + 1 }}</span>
        <el-select
          class="lc-action__kind"
          size="small"
          :model-value="action.kind"
          @update:model-value="(value: ActionKind) => patchAction(index, { kind: value })"
        >
          <el-option
            v-for="option in ACTION_KIND_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <button
          class="lc-action__btn"
          type="button"
          title="上移"
          :disabled="index === 0"
          @click="moveAction(index, -1)"
        >
          ↑
        </button>
        <button
          class="lc-action__btn"
          type="button"
          title="下移"
          :disabled="index === actions.length - 1"
          @click="moveAction(index, 1)"
        >
          ↓
        </button>
        <button
          class="lc-action__btn lc-action__btn--danger"
          type="button"
          title="删除"
          @click="removeAction(index)"
        >
          ✕
        </button>
      </div>

      <div class="lc-action__row">
        <label class="lc-action__label">执行条件</label>
        <el-input
          size="small"
          :model-value="action.when ?? ''"
          placeholder="沙箱表达式，可选，如 $form.status === 'editing'"
          @update:model-value="(value: string) => patchAction(index, { when: value || undefined })"
        />
      </div>

      <div class="lc-action__row">
        <label class="lc-action__label">延迟(ms)</label>
        <el-input
          size="small"
          type="number"
          :model-value="action.delay === undefined ? '' : String(action.delay)"
          placeholder="0"
          @update:model-value="(value: string) => setDelay(index, value ? Number(value) : undefined)"
        />
      </div>

      <div class="lc-action__row lc-action__row--block">
        <label class="lc-action__label">动作参数</label>
        <el-input
          type="textarea"
          :rows="3"
          :model-value="configText(action)"
          :placeholder="configHint(action.kind)"
          @change="(value: string) => setConfig(index, value)"
        />
      </div>
    </div>

    <el-button class="lc-action-chain__add" size="small" plain @click="addAction">+ 添加动作</el-button>
  </div>
</template>

<style scoped>
.lc-action-chain {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lc-action-chain__signature {
  padding: 6px 8px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}
.lc-action-chain__empty {
  padding: 10px;
  border: 1px dashed #e5e6eb;
  border-radius: 4px;
  font-size: 12px;
  color: #86909c;
  text-align: center;
}
.lc-action {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 8px;
  background: #fafbfc;
}
.lc-action__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.lc-action__index {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3370ff;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.lc-action__kind {
  flex: 1;
}
.lc-action__btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 3px;
  background: #fff;
  color: #4e5969;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.lc-action__btn:hover:not(:disabled) {
  border-color: #3370ff;
  color: #3370ff;
}
.lc-action__btn:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}
.lc-action__btn--danger:hover:not(:disabled) {
  border-color: #f53f3f;
  color: #f53f3f;
}
.lc-action__row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.lc-action__row--block {
  align-items: flex-start;
}
.lc-action__label {
  flex-shrink: 0;
  width: 62px;
  font-size: 12px;
  color: #86909c;
}
.lc-action-chain__add {
  width: 100%;
}
</style>
