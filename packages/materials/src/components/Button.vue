<script setup lang="ts">
import { computed } from 'vue'
import { ElButton } from 'element-plus'

defineOptions({ name: 'LcButton' })

const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
    onMounted?: string
    /** 按钮文案 */
    text?: string
    /** 按钮类型 */
    /** 空串 = Element 的默认按钮（白底灰边）——参考实现的默认值就是 '' */
    type?: '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
    size?: '' | 'large' | 'default' | 'small'
    plain?: boolean
    round?: boolean
    circle?: boolean
    disabled?: boolean
    /** 展示方式：行内 / 块级占满整行 */
    displayStyle?: 'inline' | 'block'
    /** 图标名（Element Plus 图标组件名，如 Search） */
    icon?: string
    /** 宽度，如 200px；留空自适应 */
    columnWidth?: string
  }>(),
  {
    text: '按钮',
    type: '',
    size: 'default',
    plain: false,
    round: false,
    circle: false,
    disabled: false,
    displayStyle: 'inline',
    icon: '',
    columnWidth: '',
  },
)

const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

const style = computed(() => ({
  width: props.displayStyle === 'block' ? '100%' : props.columnWidth || undefined,
}))
</script>

<template>
  <ElButton
    class="lc-button"
    :type="type"
    :size="sizeProp"
    :plain="plain"
    :round="round"
    :circle="circle"
    :disabled="disabled"
    :icon="icon || undefined"
    :style="style"
    @click="emit('click', $event)"
  >
    {{ text }}
  </ElButton>
</template>

<style>
/*
 * 参考的按钮默认档（EU 的 small：`el-button--small`）实测：
 *   字号 12px、padding `9px 15px`、圆角 3px、宽 65
 * 我们是 EP 的 default 档：字号 14px、padding `8px 15px`、圆角 4px、宽 60。
 *
 * 两边盒高都是 32px，但**字号差 2px、上下内边距差 1px**，能看出来。
 * 只作用于默认档，不动 small / large。
 */
.lc-button.el-button:not(.el-button--small):not(.el-button--large) {
  font-size: 12px;
  padding: 9px 15px;
  border-radius: 3px;
}
</style>
