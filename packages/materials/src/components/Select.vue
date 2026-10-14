<script setup lang="ts">
import { computed } from 'vue'
import { ElOption, ElSelect } from 'element-plus'

defineOptions({ name: 'LcSelect' })

export interface SelectOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[]
    placeholder?: string
    options?: SelectOption[]
    disabled?: boolean
    clearable?: boolean
    filterable?: boolean
    /** 多选；开启后 modelValue 为数组 */
    multiple?: boolean
    /** 多选时最多可选数量，0 表示不限制 */
    multipleLimit?: number
  }>(),
  {
    modelValue: '',
    placeholder: '请选择',
    options: () => [],
    disabled: false,
    clearable: true,
    filterable: false,
    multiple: false,
    multipleLimit: 0,
  },
)

/** 容错：配置错误（如静态值写成字符串）时回退为空数组，避免画布渲染报错 */
const safeOptions = computed(() => (Array.isArray(props.options) ? props.options : []))

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[]): void
  (e: 'change', value: string | string[]): void
}>()
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :filterable="filterable"
    :multiple="multiple"
    :multiple-limit="multipleLimit"
    style="width: 100%"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  >
    <ElOption
      v-for="option in safeOptions"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </ElSelect>
</template>
