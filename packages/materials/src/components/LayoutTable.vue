<script setup lang="ts">
defineOptions({ name: 'LcLayoutTable' })

withDefaults(
  defineProps<{
    /** 是否显示单元格边框 */
    border?: boolean
  }>(),
  {
    border: true,
  },
)
</script>

<template>
  <div class="lc-layout-table" :class="{ 'lc-layout-table--border': border }">
    <table>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.lc-layout-table {
  box-sizing: border-box;
  /* 空表格也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 40px;
  width: 100%;
}
.lc-layout-table table {
  width: 100%;
  border-collapse: collapse;
}
/* 单元格由子组件渲染，需用 :deep 穿透作用域 */
.lc-layout-table--border :deep(td) {
  border: 1px dashed #d9d9d9;
}
</style>
