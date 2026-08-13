<script setup lang="ts">
import { ElInputNumber } from 'element-plus'

const props = defineProps<{ modelValue?: unknown }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: number | undefined): void }>()
</script>

<template>
  <ElInputNumber
    :model-value="Number(props.modelValue ?? 0)"
    :controls="false"
    size="small"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
