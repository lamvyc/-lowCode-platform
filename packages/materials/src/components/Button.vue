<script setup lang="ts">
import { computed } from 'vue'
import { ElButton } from 'element-plus'

defineOptions({ name: 'LcButton' })

const props = withDefaults(
  defineProps<{
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
