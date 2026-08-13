<script setup lang="ts">
import { ElImage } from 'element-plus'

defineOptions({ name: 'LcImage' })

withDefaults(
  defineProps<{
    src?: string
    alt?: string
    width?: number
    height?: number
  }>(),
  {
    src: '',
    alt: '',
    width: 200,
    height: 120,
  },
)
</script>

<template>
  <ElImage
    class="lc-image"
    :src="src"
    :alt="alt"
    :style="{ width: `${width}px`, height: `${height}px` }"
    fit="cover"
  />
</template>
