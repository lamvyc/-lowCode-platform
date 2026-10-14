<script setup lang="ts">
import { ElTabPane } from 'element-plus'

defineOptions({ name: 'LcTabPane' })

withDefaults(
  defineProps<{
    /** 标签页标题 */
    label?: string
    /**
     * 标签页标识（对应 ElTabPane 的 name）。
     * 命名为 paneName 以避免与节点级「唯一名称」(props.name) 冲突。
     */
    paneName?: string
    /** 是否禁用该标签页 */
    disabled?: boolean
  }>(),
  {
    label: '标签页',
    paneName: '',
    disabled: false,
  },
)
</script>

<template>
  <ElTabPane :label="label" :name="paneName || undefined" :disabled="disabled">
    <slot />
  </ElTabPane>
</template>
