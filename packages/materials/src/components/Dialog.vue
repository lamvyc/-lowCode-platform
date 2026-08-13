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
  }>(),
  {
    dialogId: '',
    title: '弹窗',
    width: '480px',
  },
)

const runtime = useRuntimeContext()
const visible = computed({
  get: () => Boolean(runtime?.dialogs[props.dialogId]),
  set: (value: boolean) => {
    if (runtime) runtime.dialogs[props.dialogId] = value
  },
})
</script>

<template>
  <ElDialog v-model="visible" :title="title" :width="width">
    <slot />
  </ElDialog>
</template>
