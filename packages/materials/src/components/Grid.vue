<script setup lang="ts">
import { computed } from 'vue'
import { ElRow } from 'element-plus'

defineOptions({ name: 'LcGrid' })

const props = withDefaults(
  defineProps<{
    /** 列间距（px），同时作用于左右两侧 */
    gutter?: number
    /**
     * 栅格列统一高度（px）。
     *
     * 与参考实现一致：这个值作用在**每一列**上（`height`），不是整行最小高度——
     * 参考的 `grid-widget.vue` 把它作为 `:col-height` 传给每个 `grid-col-widget`，
     * 后者写成 `:style="{ height: colHeight + 'px' }"`。本平台子节点由渲染器独立渲染，
     * 父组件无法向子组件传 prop，因此改用可继承的 CSS 变量下传给 GridCol。
     * 为空 / 非正数时写 `auto`，避免嵌套栅格误继承外层的值。
     */
    colHeight?: number | string | null
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

/**
 * 逐列高度通过 CSS 变量下传（CSS 自定义属性会继承给子元素）。
 *
 * 每一行都显式写一次变量：值为 `auto` 时等价于不设高度，同时能阻断
 * “嵌套栅格继承外层栅格列高度”这条隐式继承链。
 */
const rowStyle = computed<Record<string, string>>(() => {
  // 参考实现的 colHeight 来自 el-input，旧 Schema 里可能是字符串（"120"）
  const height = typeof props.colHeight === 'number' ? props.colHeight : Number(props.colHeight)
  return {
    '--lc-grid-col-height': Number.isFinite(height) && height > 0 ? `${height}px` : 'auto',
  }
})
</script>

<template>
  <ElRow class="lc-grid" :gutter="gutter" :justify="justifyProp" :style="rowStyle">
    <slot />
  </ElRow>
</template>

<style scoped>
.lc-grid {
  box-sizing: border-box;
  /* 空栅格行也要有高度，否则画布上无法作为拖拽落点。
     50px 对齐参考（`grid-widget.vue`: `.el-row.grid-container { min-height: 50px }`）——
     实测参考 el-row 高 50、我们此前 24。 */
  min-height: 50px;
}
</style>
