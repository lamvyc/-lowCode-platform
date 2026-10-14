<script setup lang="ts">
import { computed } from 'vue'
import { ElTable, ElTableColumn } from 'element-plus'

defineOptions({ name: 'LcTable' })

export interface TableColumn {
  prop: string
  label: string
  width?: number
}

const props = withDefaults(
  defineProps<{
    data?: Record<string, unknown>[]
    columns?: TableColumn[]
    stripe?: boolean
    border?: boolean
  }>(),
  {
    data: () => [],
    columns: () => [],
    stripe: false,
    border: true,
  },
)

/** 容错：表达式/静态值配置错误时回退为空数组，避免 ElTable 内部 reduce 抛错拖垮画布 */
const rows = computed(() => (Array.isArray(props.data) ? props.data : []))
const safeColumns = computed(() => (Array.isArray(props.columns) ? props.columns : []))
</script>

<template>
  <ElTable :data="rows" :stripe="stripe" :border="border" size="small">
    <ElTableColumn
      v-for="column in safeColumns"
      :key="column.prop"
      :prop="column.prop"
      :label="column.label"
      :width="column.width"
    />
  </ElTable>
</template>
