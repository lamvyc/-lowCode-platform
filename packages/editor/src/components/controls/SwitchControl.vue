<script setup lang="ts">
import { ElSwitch } from 'element-plus'

const props = defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean): void
}>()
</script>

<template>
  <ElSwitch
    :model-value="Boolean(props.modelValue)"
    size="small"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
