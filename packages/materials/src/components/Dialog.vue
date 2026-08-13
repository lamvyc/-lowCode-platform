<script setup lang="ts">
import { computed } from 'vue'
import { ElDialog } from 'element-plus'
import { useRuntimeContext } from '../use-runtime'

defineOptions({ name: 'LcDialog' })

const props = withDefaults(
  defineProps<{
    dialogId?: string
    title?: string
    width?: string
    /** 生成代码 / 受控模式：直接绑定可见性 */
    modelValue?: boolean
  }>(),
  {
    dialogId: '',
    title: '弹窗',
    width: '480px',
    modelValue: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const runtime = useRuntimeContext()
const visible = computed({
  get: () =>
    props.modelValue !== undefined
      ? props.modelValue
      : Boolean(runtime?.dialogs[props.dialogId]),
  set: (value: boolean) => {
    if (props.modelValue !== undefined) {
      emit('update:modelValue', value)
    } else if (runtime) {
      runtime.dialogs[props.dialogId] = value
    }
  },
})
</script>

<template>
  <ElDialog v-model="visible" :title="title" :width="width">
    <slot />
  </ElDialog>
</template>
