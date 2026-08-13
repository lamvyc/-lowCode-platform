<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'

defineOptions({ name: 'LcSelect' })

export interface SelectOption {
  label: string
  value: string
}

withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    options?: SelectOption[]
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '请选择',
    options: () => [],
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  >
    <ElOption
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </ElSelect>
</template>
