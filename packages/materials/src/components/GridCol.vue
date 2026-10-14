<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { ElCol } from 'element-plus'

defineOptions({ name: 'LcGridCol' })

const props = withDefaults(
  defineProps<{
    /** 栅格占位格数（整行共 24 格） */
    span?: number
    /** 左侧间隔格数 */
    offset?: number
    /** 向右移动格数 */
    push?: number
    /** 向左移动格数 */
    pull?: number
    /** 是否启用响应式栅格（启用后按 md/sm/xs 分档，不再使用 span） */
    responsive?: boolean
    /** ≥992px 时的占位格数 */
    md?: number
    /** ≥768px 时的占位格数 */
    sm?: number
    /** <768px 时的占位格数 */
    xs?: number
    /** 单元格最小高度（px）；为空时不额外限制 */
    colHeight?: number | null
  }>(),
  {
    span: 12,
    offset: 0,
    push: 0,
    pull: 0,
    responsive: false,
    md: 12,
    sm: 12,
    xs: 12,
    colHeight: null,
  },
)

/** 容错：只有合法正数才写内联高度，其余情况回落到 class 上的 24px 落点高度 */
const colStyle = computed<CSSProperties | undefined>(() =>
  typeof props.colHeight === 'number' && props.colHeight > 0
    ? { minHeight: `${props.colHeight}px` }
    : undefined,
)
</script>

<template>
  <ElCol
    class="lc-grid-col"
    :span="responsive ? undefined : span"
    :offset="offset || undefined"
    :push="push || undefined"
    :pull="pull || undefined"
    :md="responsive ? md : undefined"
    :sm="responsive ? sm : undefined"
    :xs="responsive ? xs : undefined"
    :style="colStyle"
  >
    <slot />
  </ElCol>
</template>

<style scoped>
.lc-grid-col {
  box-sizing: border-box;
  /* 空格子也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 24px;
}
</style>
