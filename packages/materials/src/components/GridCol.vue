<script setup lang="ts">
import { computed } from 'vue'
import { ElCol } from 'element-plus'
import { useLayoutType } from '@lowcode/runtime'

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
    /**
     * 是否启用响应式栅格。
     *
     * 与参考实现一致：
     * - 设计器 / 预览（`layoutType` 有值）：按当前设备档位把 md/sm/xs 换算成 span，
     *   同时清掉断点属性（`grid-col-widget.vue` 的 layoutProps 就是这么算的）；
     * - 独立运行时（无 `layoutType`）：交给 Element Plus 的 md/sm/xs 断点。
     */
    responsive?: boolean
    /** PC 档位占位格数（≥992px 断点；设计器 PC 档直接用它） */
    md?: number
    /** Pad 档位占位格数（≥768px 断点；设计器 Pad 档直接用它） */
    sm?: number
    /** H5 档位占位格数（<768px 断点；设计器 H5 档直接用它） */
    xs?: number
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
  },
)

const layoutType = useLayoutType()

/** 当前设备档位对应的 span；未提供设备档位时返回 undefined（走断点） */
const deviceSpan = computed<number | undefined>(() => {
  const type = layoutType.value
  if (!type) return undefined
  if (type === 'h5') return props.xs || 12
  if (type === 'pad') return props.sm || 12
  return props.md || 12
})

const spanProp = computed(() => (props.responsive ? deviceSpan.value : props.span))

/** 只有在“响应式 + 未提供设备档位”时才把 md/sm/xs 交给 Element Plus 的断点 */
function breakpoint(value: number): number | undefined {
  return props.responsive && layoutType.value === undefined ? value : undefined
}
const mdProp = computed(() => breakpoint(props.md))
const smProp = computed(() => breakpoint(props.sm))
const xsProp = computed(() => breakpoint(props.xs))
</script>

<template>
  <ElCol
    class="lc-grid-col"
    :span="spanProp"
    :offset="offset || undefined"
    :push="push || undefined"
    :pull="pull || undefined"
    :md="mdProp"
    :sm="smProp"
    :xs="xsProp"
  >
    <slot />
  </ElCol>
</template>

<style scoped>
.lc-grid-col {
  box-sizing: border-box;
  /* 空格子也要有高度，否则画布上无法作为拖拽落点。
     对齐参考（`grid-col-widget.vue`: `.grid-cell { min-height: 38px; padding: 3px }`）：
     实测参考 el-col 高 38、padding `3px 6px`；我们此前 24 / `0px 6px`
     （横向 6px 已由栅格 gutter 提供，这里只补纵向 3px）。 */
  min-height: 38px;
  padding-top: 3px;
  padding-bottom: 3px;
  /* 参考实现的 colHeight 是逐列 `height`；父级 Grid 通过 CSS 变量下传。
     未设置（auto）时等价于原来的自适应高度。 */
  height: var(--lc-grid-col-height, auto);
  /* 选中态操作条 / 栅格列标签以本列为定位基准（参考 `.grid-cell { position: relative }`） */
  position: relative;
  /* EP 的 .el-row 是 flex（EU 是 block），格子作为 flex item 会被拉伸到整行高度
     （50px），而参考里它只有自己的 38px。align-self 阻止拉伸。 */
  align-self: flex-start;
}
</style>
