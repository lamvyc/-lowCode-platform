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
