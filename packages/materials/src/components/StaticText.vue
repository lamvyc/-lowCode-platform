<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'LcStaticText' })

const props = withDefaults(
  defineProps<{
    /** 文本内容 */
    textContent?: string
    /** 对齐方式 */
    textAlign?: 'left' | 'center' | 'right'
    /** 字号，如 '13px' */
    fontSize?: string
    /** 是否保留换行与连续空格 */
    preWrap?: boolean
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
  }>(),
  {
    textContent: 'static text',
    textAlign: 'left',
    fontSize: '13px',
    preWrap: false,
    columnWidth: '',
  },
)

const textStyle = computed(() => ({
  width: props.columnWidth || undefined,
  textAlign: props.textAlign,
  fontSize: props.fontSize || undefined,
  whiteSpace: props.preWrap ? ('pre-wrap' as const) : ('normal' as const),
}))
</script>

<template>
  <div class="lc-static-text" :style="textStyle">{{ textContent }}</div>
</template>

<style scoped>
.lc-static-text {
  box-sizing: border-box;
  color: #1d2129;
}
</style>
