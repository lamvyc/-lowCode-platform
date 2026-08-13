<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import type { PropOption } from '@lowcode/schema'

const props = defineProps<{ modelValue?: unknown; options?: PropOption[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <ElSelect
    :model-value="String(props.modelValue ?? '')"
    size="small"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ElOption
      v-for="option in props.options ?? []"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </ElSelect>
</template>
