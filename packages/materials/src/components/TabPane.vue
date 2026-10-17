<script setup lang="ts">
import { computed, inject, onMounted, useId } from 'vue'
import { ElTabPane } from 'element-plus'

defineOptions({ name: 'LcTabPane' })

const props = withDefaults(
  defineProps<{
    /** 标签页标题 */
    label?: string
    /**
     * 标签页标识（对应 ElTabPane 的 name）。
     * 命名为 paneName 以避免与节点级「唯一名称」(props.name) 冲突。
     */
    paneName?: string
    /** 是否为默认激活面板（参考实现的 `options.active`） */
    active?: boolean
    /** 是否禁用该标签页 */
    disabled?: boolean
  }>(),
  {
    label: '标签页',
    paneName: '',
    disabled: false,
  },
)

/**
 * ⚠️ 这里解决的是一个真实 bug：**新建标签页后没有任何面板处于激活状态**。
 *
 * 原先写的是 `:name="paneName || undefined"` —— paneName 默认空串，于是这个
 * name 交给 Element Plus 自动生成；而 `Tab.vue` 那边的 `active` 是空串，
 * 两边**永远对不上**，结果所有面板都是 `aria-hidden="true"`（display: none）。
 *
 * 症状：新建的标签页内容区是空的（其实是"没选中任何面板"），
 * 且 el-tabs 比参考矮 28px（因为激活面板的 min-height 不生效）。
 *
 * 修法：paneName 为空时用 `useId()` 生成一个**稳定**的 name，
 * 并注册到父级 Tab，让它在没指定 activeName 时激活第一个面板。
 */
const paneId = `lc-pane-${useId()}`
const resolvedName = computed(() => props.paneName || paneId)

const registerPane = inject<((name: string) => void) | undefined>(
  'lcTabRegisterPane',
  undefined,
)
/** 父级 Tab 提供的"显式指定激活项"入口 */
const preferPane = inject<(() => void) | undefined>('lcTabPreferredPane', undefined)

onMounted(() => {
  // `active: true` 的面板优先成为默认激活项（参考实现的 `options.active`）。
  // 注意：父级 Tab 的自动逻辑是"最后注册的生效"，所以显式指定必须在
  // 注册**之前**告知父级，让它进入"用户已选择"状态，不再被自动逻辑覆盖。
  if (props.active === true) preferPane?.()
  registerPane?.(resolvedName.value)
})
</script>

<template>
  <ElTabPane :label="label" :name="resolvedName" :disabled="disabled">
    <slot />
  </ElTabPane>
</template>
