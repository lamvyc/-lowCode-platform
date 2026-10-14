<script setup lang="ts">
import { computed } from 'vue'
import { ElInput } from 'element-plus'

defineOptions({ name: 'LcInput' })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** 输入类型：单行文本 / 密码 / 多行文本 */
    type?: 'text' | 'password' | 'textarea'
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    readonly?: boolean
    /** 最大长度，0 表示不限制 */
    maxlength?: number
    /** 是否显示字数统计（依赖 maxlength） */
    showWordLimit?: boolean
    /** 多行文本行数 */
    rows?: number
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '请输入',
    clearable: true,
    disabled: false,
    readonly: false,
    maxlength: 0,
    showWordLimit: false,
    rows: 3,
  },
)

/** 容错：静态值配置成非字符串时统一转字符串，避免 ElInput 渲染异常 */
const modelText = computed(() => {
  const value = props.modelValue
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()
</script>

<template>
  <ElInput
    :model-value="modelText"
    :type="type"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxlength || undefined"
    :show-word-limit="showWordLimit && maxlength > 0"
    :rows="type === 'textarea' ? rows : undefined"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
