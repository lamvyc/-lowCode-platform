<script setup lang="ts">
import { ref, watch } from 'vue'

defineOptions({ name: 'LcCard' })

const props = withDefaults(
  defineProps<{
    /** 卡片标题（画布上永远显示 label，而不是 name） */
    label?: string
    /** 初始是否收起 */
    collapsed?: boolean
    /** 是否显示右上角折叠按钮 */
    showCollapse?: boolean
    /** 是否隐藏标题区 */
    hideTitle?: boolean
    /** 卡片宽度 */
    width?: string
  }>(),
  {
    label: '',
    collapsed: false,
    showCollapse: true,
    hideTitle: false,
    width: '100%',
  },
)

/** 折叠只隐藏 children 内容，不修改 Schema 结构 */
const isCollapsed = ref(Boolean(props.collapsed))
watch(
  () => props.collapsed,
  (value) => {
    isCollapsed.value = Boolean(value)
  },
)

function toggleCollapse(): void {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="lc-card" :style="{ width: width && width !== 'auto' ? width : undefined }">
    <div v-if="!hideTitle" class="lc-card__header">
      <span class="lc-card__title">{{ label }}</span>
      <button
        v-if="showCollapse"
        class="lc-card__collapse"
        type="button"
        :title="isCollapsed ? '展开' : '收起'"
        @click.stop="toggleCollapse"
      >
        {{ isCollapsed ? '▸' : '▾' }}
      </button>
    </div>
    <div v-show="!isCollapsed" class="lc-card__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.lc-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  /* 不用 overflow:hidden，避免裁掉编辑器里子组件的选中浮层 */
}
.lc-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid #f2f3f5;
  background: #fafbfc;
  border-radius: 6px 6px 0 0;
  flex-shrink: 0;
}
.lc-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-card__collapse {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  border-radius: 4px;
  flex-shrink: 0;
}
.lc-card__collapse:hover {
  background: #e5e6eb;
  color: #1f2329;
}
.lc-card__body {
  padding: 12px;
  min-height: 24px;
  border-radius: 0 0 6px 6px;
}
</style>
