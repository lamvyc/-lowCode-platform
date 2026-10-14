<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElTabs } from 'element-plus'

defineOptions({ name: 'LcTab' })

const props = withDefaults(
  defineProps<{
    /** 标签页样式：边框卡片 / 卡片 / 默认 */
    displayType?: 'border-card' | 'card' | ''
    /** 默认激活的标签页 name；为空时由 ElTabs 自动选中第一个 pane */
    activeName?: string
  }>(),
  {
    displayType: 'border-card',
    activeName: '',
  },
)

/** 本地激活项：为空字符串时 ElTabs 会自行选中第一个 pane */
const active = ref<string | number>(props.activeName)

watch(
  () => props.activeName,
  (value) => {
    active.value = value
  },
)
</script>

<template>
  <ElTabs v-model="active" class="lc-tab" :type="displayType || undefined">
    <slot />
  </ElTabs>
</template>

<style scoped>
.lc-tab {
  box-sizing: border-box;
  /* 无 pane 时也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 40px;
}
</style>
