<script setup lang="ts">
import { ElButton } from 'element-plus'

defineOptions({ name: 'LcButton' })

withDefaults(
  defineProps<{
    text?: string
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
    size?: 'small' | 'default' | 'large'
    disabled?: boolean
    plain?: boolean
    round?: boolean
    circle?: boolean
  }>(),
  {
    text: '按钮',
    type: 'primary',
    size: 'default',
    disabled: false,
    plain: false,
    round: false,
    circle: false,
  },
)
</script>

<template>
  <ElButton
    :type="type"
    :size="size"
    :disabled="disabled"
    :plain="plain"
    :round="round"
    :circle="circle"
  >
    {{ text }}
  </ElButton>
</template>
