<script setup lang="ts">
import { ElDivider } from 'element-plus'

defineOptions({ name: 'LcDivider' })

withDefaults(
  defineProps<{
    /** 分割线文案 */
    label?: string
    /** 分割线方向 */
    direction?: 'horizontal' | 'vertical'
    /** 文案位置 */
    contentPosition?: 'left' | 'center' | 'right'
  }>(),
  {
    label: '',
    direction: 'horizontal',
    contentPosition: 'center',
  },
)
</script>

<template>
  <ElDivider :direction="direction" :content-position="contentPosition">{{ label }}</ElDivider>
</template>
