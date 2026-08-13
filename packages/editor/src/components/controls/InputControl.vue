<script setup lang="ts">
import { ElInput } from 'element-plus'

const props = defineProps<{ modelValue?: unknown; placeholder?: string }>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <ElInput
    :model-value="String(props.modelValue ?? '')"
    :placeholder="props.placeholder ?? ''"
    size="small"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
