<script setup lang="ts">
import { ElCard, ElIcon } from 'element-plus'
import { ref, watch } from 'vue'

defineOptions({ name: 'LcCard' })

/**
 * 卡片容器 —— 对齐参考实现的**扩展示例**
 * `variant-form/src/extension/samples/card/card-widget.vue`。
 *
 * 参考在那边包的是 `el-card`（header 槽放标题 + 折叠箭头），我们此前是手写 div。
 * 改成包 `el-card` 的原因：
 *  ① 结构一致（`el-card` / `el-card__header` / `el-card__body`），画布级 A/B 不再报结构差异；
 *  ② 直接拿到 `shadow` 能力——参考的 `cardSchema.options.shadow` 我们此前**没有实现**；
 *  ③ 少维护一套自绘的边框/圆角/内边距。
 *
 * ⚠️ 折叠箭头不能用 Element UI 的 `el-icon-arrow-down/up` 类名：那是 EU 的图标字体，
 * Element Plus 没有。这里用 `ElIcon` + 内联 SVG 手绘 chevron，避免为此新增
 * `@element-plus/icons-vue` 依赖（目前只有 editor 包用它）。
 */
const props = withDefaults(
  defineProps<{
    /** 卡片标题（画布上永远显示 label，而不是 name） */
    label?: string
    /** 初始是否收起 */
    collapsed?: boolean
    /** 是否显示右上角折叠按钮 */
    showCollapse?: boolean
    /** 是否隐藏标题区（本仓库的额外能力，参考没有） */
    hideTitle?: boolean
    /** 卡片宽度，如 '100%' / '320px' */
    width?: string
    /** 阴影显示时机，对齐参考的 `shadow` */
    shadow?: 'always' | 'hover' | 'never'
  }>(),
  {
    label: '',
    collapsed: false,
    showCollapse: true,
    hideTitle: false,
    width: '100%',
    shadow: 'never',
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

/** 向下 / 向上的 chevron，1024 视图，与其它内联图标同一风格 */
const CHEVRON_DOWN = 'M512 704 192 384l64-64 256 256 256-256 64 64z'
const CHEVRON_UP = 'M512 320l320 320-64 64-256-256-256 256-64-64z'
</script>

<template>
  <ElCard
    class="lc-card"
    :shadow="shadow"
    :style="{ width: width && width !== 'auto' ? width : undefined }"
  >
    <template v-if="!hideTitle" #header>
      <div class="lc-card__header">
        <span class="lc-card__title">{{ label }}</span>
        <ElIcon
          v-if="showCollapse"
          class="lc-card__fold"
          :title="isCollapsed ? '展开' : '收起'"
          @click.stop="toggleCollapse"
        >
          <svg viewBox="0 0 1024 1024" aria-hidden="true">
            <path :d="isCollapsed ? CHEVRON_DOWN : CHEVRON_UP" />
          </svg>
        </ElIcon>
      </div>
    </template>
    <div v-show="!isCollapsed" class="lc-card__body">
      <slot />
    </div>
  </ElCard>
</template>

<style scoped>
/*
 * 下面三条都来自**参考的卡片 widget 自己的 scoped 样式**
 * （`extension/samples/card/card-widget.vue`），不是 Element 的默认值：
 *
 *   .card-container { margin: 3px; }                       ← 四边，不是只上下
 *   ::v-deep .el-card__header { padding: 10px 12px; }      ← 覆盖库默认的 18px 20px
 *   .form-widget-list { min-height: 28px; }                ← 内容区最小高
 *
 * 只读库的 CSS 是找不到这些的——必须实测（或读参考的业务样式）。
 */
.lc-card {
  box-sizing: border-box;
  margin: 3px;
  /* ⚠️ Element Plus 的 `.el-card` 带 `overflow: hidden`，Element UI 没有。
     在编辑器画布里这会把子组件的选中框/操作条裁掉（节点贴边时尤甚）。
     置为 visible：既与参考（EU）一致，也避免编辑器浮层被裁。
     我最初手写卡片时也是特意避开了 overflow:hidden。 */
  overflow: visible;
}
.lc-card :deep(.el-card__header) {
  padding: 10px 12px;
}
.lc-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.lc-card__title {
  /* 行高 18px：参考的标题实测就是 18px 高（Element UI 那边不设行高，继承到的值更小），
     而 Element Plus 下继承到 22px —— 4px 的差会一路传到 header（39→43）和整卡（109→113）。 */
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-card__fold {
  cursor: pointer;
  flex-shrink: 0;
}
.lc-card__body {
  /* 对齐参考的 `.form-widget-list { min-height: 28px }` */
  min-height: 28px;
}
</style>
