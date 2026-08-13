<script setup lang="ts">
defineOptions({ name: 'LcContainer' })

withDefaults(
  defineProps<{
    direction?: 'row' | 'column'
    gap?: number
    padding?: number
    backgroundColor?: string
    align?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
    justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  }>(),
  {
    direction: 'column',
    gap: 8,
    padding: 12,
    backgroundColor: '',
    align: 'stretch',
    justify: 'flex-start',
  },
)
</script>

<template>
  <div
    class="lc-container"
    :style="{
      display: 'flex',
      flexDirection: direction,
      gap: `${gap}px`,
      padding: `${padding}px`,
      backgroundColor: backgroundColor || undefined,
      alignItems: align,
      justifyContent: justify,
      minHeight: '24px',
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.lc-container {
  box-sizing: border-box;
  border: 1px dashed transparent;
}
</style>
