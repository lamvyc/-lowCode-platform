<script setup lang="ts">
import { computed } from 'vue'
import MonacoEditor from './MonacoEditor.vue'

const props = defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void }>()

const text = computed(() => JSON.stringify(props.modelValue ?? [], null, 2))

function onChange(value: string) {
  try {
    emit('update:modelValue', JSON.parse(value) as unknown)
  } catch {
    // 编辑中非法 JSON 不落库，等待合法
  }
}
</script>

<template>
  <MonacoEditor
    :model-value="text"
    language="json"
    :height="120"
    @update:model-value="onChange"
  />
</template>
