<script setup lang="ts">
import { ElAlert } from 'element-plus'

defineOptions({ name: 'LcAlert' })

/**
 * 提示（alert）——对齐参考实现的扩展字段示例
 * `variant-form/src/extension/samples/alert/alert-widget.vue`。
 *
 * 它在参考实现里属于「自定义扩展字段」分组：用来演示如何接入自定义物料。
 * 默认值逐项照搬参考的 `alertSchema.options`。
 *
 * 与参考的差异：参考用 `new Function(field.options.onClose)` 执行字符串代码，
 * 本仓库统一走事件系统（`emit('close')`），不做字符串求值。
 */
withDefaults(
  defineProps<{
    /** 标题 */
    title?: string
    /** 主题 */
    type?: 'success' | 'warning' | 'info' | 'error'
    /** 辅助描述；为空时不渲染描述行 */
    description?: string
    /** 是否可关闭 */
    closable?: boolean
    /** 关闭按钮文案；为空时显示图标 */
    closeText?: string
    /** 文字是否居中 */
    center?: boolean
    /** 是否显示类型图标 */
    showIcon?: boolean
    /** 主题样式 */
    effect?: 'light' | 'dark'
  }>(),
  {
    title: 'Good things are coming...',
    type: 'info',
    description: '',
    closable: true,
    closeText: '',
    center: true,
    showIcon: false,
    effect: 'light',
  },
)

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <ElAlert
    class="lc-alert"
    :title="title"
    :type="type"
    :description="description"
    :closable="closable"
    :close-text="closeText"
    :center="center"
    :show-icon="showIcon"
    :effect="effect"
    @close="emit('close')"
  />
</template>

<style>
/*
 * ⚠️ 非 scoped：`ElAlert` 是否把 class 透传到根元素取决于其实现
 * （ElUpload 就不透传），用非 scoped 块最稳；类名带 lc- 前缀不会误伤。
 *
 * 参考的 alert widget 样式块是**空的**，所以下面这些是 EU 与 EP 的**库默认差异**，
 * 不是参考的业务覆盖（与卡片的 margin 3px 那类不同）：
 *
 *   el-alert__title   参考 13px / display inline；我们 14px / block
 *   el-alert__content 参考 padding `0 8px` / display block；我们 `0` / flex
 *   el-alert           参考高 36；我们 40
 */
.lc-alert .el-alert__title {
  font-size: 13px;
  display: inline;
  /* 标题高度会带着整个提示一起长：参考标题 15px 高 → 内容 20 → 提示 36；
     我们 18 → 24 → 40。行高是那个多出来的 4px 的源头。 */
  line-height: 15px;
}
.lc-alert .el-alert__content {
  padding: 0 8px;
  display: block;
}
</style>
