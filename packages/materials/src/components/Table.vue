<script setup lang="ts">
import { ElTable, ElTableColumn } from 'element-plus'

defineOptions({ name: 'LcTable' })

export interface TableColumn {
  prop: string
  label: string
  width?: number
}

withDefaults(
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
</script>

<template>
  <ElTable :data="data" :stripe="stripe" :border="border" size="small">
    <ElTableColumn
      v-for="column in columns"
      :key="column.prop"
      :prop="column.prop"
      :label="column.label"
      :width="column.width"
    />
  </ElTable>
</template>
