<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

defineOptions({ name: 'LcLayoutTableCell' })

const props = withDefaults(
  defineProps<{
    /** 横向合并的列数 */
    colspan?: number
    /** 纵向合并的行数 */
    rowspan?: number
    /** 单元格宽度，原样写入样式，如 '120px' / '30%' */
    cellWidth?: string
    /** 单元格高度，原样写入样式，如 '60px' */
    cellHeight?: string
    /** 是否对长内容强制换行（word-break: break-all） */
    wordBreak?: boolean
  }>(),
  {
    colspan: 1,
    rowspan: 1,
    cellWidth: '',
    cellHeight: '',
    wordBreak: false,
  },
)

const cellStyle = computed<CSSProperties>(() => ({
  width: props.cellWidth || undefined,
  height: props.cellHeight || undefined,
  wordBreak: props.wordBreak ? 'break-all' : undefined,
}))
</script>

<template>
  <td class="lc-layout-table-cell" :colspan="colspan" :rowspan="rowspan" :style="cellStyle">
    <slot />
  </td>
</template>

<style scoped>
.lc-layout-table-cell {
  box-sizing: border-box;
  min-width: 40px;
  min-height: 32px;
  padding: 4px;
  vertical-align: top;
}
</style>
