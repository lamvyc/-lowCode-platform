<script setup lang="ts">
import { ElButton } from 'element-plus'

defineOptions({ name: 'LcButton' })

withDefaults(
  defineProps<{
    text?: string
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
    size?: 'small' | 'default' | 'large'
    disabled?: boolean
  }>(),
  {
    text: '按钮',
    type: 'primary',
    size: 'default',
    disabled: false,
  },
)
</script>

<template>
  <ElButton :type="type" :size="size" :disabled="disabled">
    {{ text }}
  </ElButton>
</template>
