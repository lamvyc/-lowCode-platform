<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'LcHtmlText' })

const props = withDefaults(
  defineProps<{
    /** HTML 内容（原样渲染，不做转义处理） */
    htmlContent?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
  }>(),
  {
    htmlContent: '<b>html text</b>',
    columnWidth: '',
  },
)

const htmlStyle = computed(() => ({
  width: props.columnWidth || undefined,
}))
</script>

<template>
  <div v-html="htmlContent" class="lc-html-text" :style="htmlStyle" />
</template>

<style scoped>
.lc-html-text {
  box-sizing: border-box;
  color: #1d2129;
}
</style>
