<script setup lang="ts">
defineOptions({ name: 'LcLayoutTableRow' })
</script>

<template>
  <tr class="lc-layout-table-row">
    <slot />
  </tr>
</template>

<style scoped>
/* tr 上 min-height 不生效，height 在表格布局中会被当作最小高度，保证空行也是可落点区域 */
.lc-layout-table-row {
  height: 32px;
  min-height: 32px;
}
</style>
