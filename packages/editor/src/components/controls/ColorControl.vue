<script setup lang="ts">
import { ElColorPicker } from 'element-plus'

const props = defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string | null): void }>()
</script>

<template>
  <ElColorPicker
    :model-value="String(props.modelValue ?? '')"
    size="small"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
