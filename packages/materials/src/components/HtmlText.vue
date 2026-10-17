<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'LcHtmlText' })

const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
    onMounted?: string
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
