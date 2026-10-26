<script setup lang="ts">
import { computed, ref } from 'vue'
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

/**
 * 动作参数字段的本地草稿（key = action.id）。
 *
 * ⚠️ 为什么需要它：`el-input` 是受控组件——输入后会把原生输入框的值重置回
 * `modelValue`。此前这里只写了 `:model-value` + `@change`（失焦才触发），
 * 于是每次按键都被异步回滚，表现为**动作参数完全输不进去**（永远是 `{}`）。
 * 现在输入过程中把文本留在本地草稿里，JSON 合法时再写回动作链。
 */
const configDrafts = ref<Record<string, string>>({})

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
  const removed = actions.value[index]
  if (removed) clearConfigDraft(removed, index)
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

function actionKey(action: EventAction, index: number): string {
  return action.id ?? `index:${index}`
}

/** 展示值：编辑中优先用草稿，否则用动作链里的配置（格式化 JSON） */
function configDraft(action: EventAction, index: number): string {
  return configDrafts.value[actionKey(action, index)] ?? configText(action)
}

function parseConfig(text: string): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const parsed: unknown = text.trim() ? JSON.parse(text) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false }
  }
}

function clearConfigDraft(action: EventAction, index: number): void {
  const key = actionKey(action, index)
  if (!(key in configDrafts.value)) return
  const next = { ...configDrafts.value }
  delete next[key]
  configDrafts.value = next
}

/** 输入中：保留草稿（否则受控输入会被回滚），JSON 合法时即时写回 */
function onConfigInput(action: EventAction, index: number, text: string): void {
  const key = actionKey(action, index)
  configDrafts.value = { ...configDrafts.value, [key]: text }
  const parsed = parseConfig(text)
  if (parsed.ok) patchAction(index, { config: parsed.value })
}

/** 失焦：校验并规范化；非法 JSON 保留草稿，方便继续修改 */
function onConfigBlur(action: EventAction, index: number): void {
  const key = actionKey(action, index)
  const text = configDrafts.value[key]
  if (text === undefined) return
  const parsed = parseConfig(text)
  if (!parsed.ok) {
    ElMessage.error('动作参数必须是 JSON 对象，如 {"prop":"text","value":"新文案"}')
    return
  }
  patchAction(index, { config: parsed.value })
  const next = { ...configDrafts.value }
  delete next[key]
  configDrafts.value = next
}

/** 切换动作类型：丢弃该动作的旧草稿，展示当前配置的格式化结果 */
function setKind(action: EventAction, index: number, kind: ActionKind): void {
  clearConfigDraft(action, index)
  patchAction(index, { kind })
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
          @update:model-value="(value: ActionKind) => setKind(action, index, value)"
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
          :model-value="configDraft(action, index)"
          :placeholder="configHint(action.kind)"
          @update:model-value="(value: string) => onConfigInput(action, index, value)"
          @blur="onConfigBlur(action, index)"
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
