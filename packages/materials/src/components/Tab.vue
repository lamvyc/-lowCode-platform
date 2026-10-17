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
  <!-- 外面这层对应参考的 `.tab-container`（`margin: 2px`）。
       ⚠️ 2px 必须挂在**包裹层**上而不是 `.el-tabs` 上：
       两者都会让 el-tabs 窄 4px，但参考的 el-tabs 自己 margin 是 0。 -->
  <div class="lc-tab-container">
    <ElTabs v-model="active" class="lc-tab" :type="displayType || undefined">
      <slot />
    </ElTabs>
  </div>
</template>

<style scoped>
.lc-tab {
  box-sizing: border-box;
  /* 无 pane 时也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 40px;
}

/* 参考的 `tab-widget.vue` 里 `.tab-container { margin: 2px }`，
   于是它的 el-tabs 比容器窄 4px（实测 1000 vs 我们 1004）。 */
.lc-tab-container {
  margin: 2px;
}

/* ⚠️ 用 `.lc-tab`（它确实落在 `.el-tabs` 上）做锚点，而不是给 ElTabPane 加类名——
   后者不会透传到 `.el-tab-pane`（同 ElUpload）。
   参考 `tab-widget.vue`：`.tab-container .form-widget-list { min-height: 28px }`，
   即每个面板内容区至少 28px。实测参考 el-tabs 高 99、我们 71，差的正是这 28px。 */
/* ⚠️ 必须走 `:deep()`：本块是 `scoped`，直接写 `.el-tab-pane` 会编译成
   `.el-tab-pane[data-v-x]`，而面板是 ElTabs 的内部元素、**没有 scope 属性**，
   规则永远不匹配（实测 min-height 仍是 0px）。
   `.lc-tab` 本身落在 ElTabs 根元素（我们模板的根），带 scope 属性，所以能当锚点。 */
.lc-tab :deep(.el-tab-pane) {
  min-height: 28px;
}
</style>
