<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { ElRow } from 'element-plus'

defineOptions({ name: 'LcGrid' })

const props = withDefaults(
  defineProps<{
    /** 列间距（px），同时作用于左右两侧 */
    gutter?: number
    /** 整行最小高度（px）；为空时不额外限制，仅保留 24px 的可拖拽落点高度 */
    colHeight?: number | null
    /** 水平排列方式 */
    justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
  }>(),
  {
    gutter: 12,
    colHeight: null,
    justify: 'start',
  },
)

/** 平台取值与 Element Plus 的 ElRow justify 完全对齐，这里显式映射以便后续扩展 */
const JUSTIFY_MAP = {
  start: 'start',
  center: 'center',
  end: 'end',
  'space-between': 'space-between',
  'space-around': 'space-around',
} as const

const justifyProp = computed(() => JUSTIFY_MAP[props.justify])

/** 容错：只有合法正数才写内联高度，其余情况回落到 class 上的 24px 落点高度 */
const rowStyle = computed<CSSProperties | undefined>(() =>
  typeof props.colHeight === 'number' && props.colHeight > 0
    ? { minHeight: `${props.colHeight}px` }
    : undefined,
)
</script>

<template>
  <ElRow class="lc-grid" :gutter="gutter" :justify="justifyProp" :style="rowStyle">
    <slot />
  </ElRow>
</template>

<style scoped>
.lc-grid {
  box-sizing: border-box;
  /* 空栅格行也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 24px;
}
</style>
