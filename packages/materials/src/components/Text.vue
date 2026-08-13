<script setup lang="ts">
defineOptions({ name: 'LcText' })

withDefaults(
  defineProps<{
    text?: string
    color?: string
    fontSize?: number
    bold?: boolean
    align?: 'left' | 'center' | 'right'
  }>(),
  {
    text: '文本',
    color: '',
    fontSize: 14,
    bold: false,
    align: 'left',
  },
)
</script>

<template>
  <div
    class="lc-text"
    :style="{
      color: color || undefined,
      fontSize: `${fontSize}px`,
      fontWeight: bold ? 700 : 400,
      textAlign: align,
    }"
  >
    {{ text }}
  </div>
</template>

<style scoped>
.lc-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
