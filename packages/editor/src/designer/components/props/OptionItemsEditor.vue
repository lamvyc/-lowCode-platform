<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElInput } from 'element-plus'

interface OptionItem {
  label: string
  value: string
  [key: string]: unknown
}

const props = defineProps<{
  modelValue?: unknown
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: OptionItem[]): void }>()

/** 归一化为 { label, value } 列表，兼容字符串数组写法 */
const items = computed<OptionItem[]>(() => {
  const raw = props.modelValue
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      return {
        ...record,
        label: String(record.label ?? record.value ?? ''),
        value: String(record.value ?? record.label ?? ''),
      }
    }
    return { label: String(item), value: String(item) }
  })
})

function commit(next: OptionItem[]): void {
  emit('update:modelValue', next)
}

function addItem(): void {
  const index = items.value.length + 1
  commit([...items.value, { label: `选项${index}`, value: `option${index}` }])
}

function removeItem(index: number): void {
  commit(items.value.filter((_, current) => current !== index))
}

function moveItem(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  commit(next)
}

function updateItem(index: number, key: 'label' | 'value', value: string): void {
  commit(items.value.map((item, current) => (current === index ? { ...item, [key]: value } : item)))
}
</script>

<template>
  <div class="lc-option-items">
    <div class="lc-option-items__head">
      <span class="lc-option-items__col">显示文本</span>
      <span class="lc-option-items__col">选项值</span>
      <span class="lc-option-items__ops" />
    </div>

    <div v-if="items.length === 0" class="lc-option-items__empty">暂无选项，点击下方按钮添加</div>

    <div v-for="(item, index) in items" :key="index" class="lc-option-items__row">
      <el-input
        class="lc-option-items__col"
        size="small"
        :model-value="item.label"
        placeholder="显示文本"
        @update:model-value="(value: string) => updateItem(index, 'label', value)"
      />
      <el-input
        class="lc-option-items__col"
        size="small"
        :model-value="item.value"
        placeholder="选项值"
        @update:model-value="(value: string) => updateItem(index, 'value', value)"
      />
      <span class="lc-option-items__ops">
        <button
          class="lc-option-items__btn"
          type="button"
          title="上移"
          :disabled="index === 0"
          @click="moveItem(index, -1)"
        >
          ↑
        </button>
        <button
          class="lc-option-items__btn"
          type="button"
          title="下移"
          :disabled="index === items.length - 1"
          @click="moveItem(index, 1)"
        >
          ↓
        </button>
        <button
          class="lc-option-items__btn lc-option-items__btn--danger"
          type="button"
          title="删除"
          @click="removeItem(index)"
        >
          ✕
        </button>
      </span>
    </div>

    <el-button class="lc-option-items__add" size="small" plain @click="addItem">+ 添加选项</el-button>
  </div>
</template>

<style scoped>
.lc-option-items {
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  padding: 6px;
  background: #fafbfc;
}
.lc-option-items__head {
  display: flex;
  gap: 6px;
  padding: 0 0 4px;
  font-size: 11px;
  color: #86909c;
}
.lc-option-items__row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.lc-option-items__col {
  flex: 1;
  min-width: 0;
}
.lc-option-items__ops {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  width: 66px;
  justify-content: flex-end;
}
.lc-option-items__btn {
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
.lc-option-items__btn:hover:not(:disabled) {
  border-color: #3370ff;
  color: #3370ff;
}
.lc-option-items__btn:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}
.lc-option-items__btn--danger:hover:not(:disabled) {
  border-color: #f53f3f;
  color: #f53f3f;
}
.lc-option-items__empty {
  padding: 8px 0;
  font-size: 12px;
  color: #86909c;
  text-align: center;
}
.lc-option-items__add {
  width: 100%;
}
</style>
