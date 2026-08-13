<script setup lang="ts">
import MonacoEditor from './MonacoEditor.vue'

const props = withDefaults(
  defineProps<{ modelValue?: string; height?: number }>(),
  { modelValue: '', height: 76 },
)
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <div>
    <MonacoEditor
      :model-value="props.modelValue"
      language="javascript"
      :height="props.height"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
