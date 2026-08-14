<script setup lang="ts">
import type { PropConfig } from '@lowcode/schema'
import ColorControl from '../controls/ColorControl.vue'
import ExpressionControl from '../controls/ExpressionControl.vue'
import InputControl from '../controls/InputControl.vue'
import JsonControl from '../controls/JsonControl.vue'
import NumberControl from '../controls/NumberControl.vue'
import SelectControl from '../controls/SelectControl.vue'
import SwitchControl from '../controls/SwitchControl.vue'

const props = defineProps<{
  config: PropConfig
  value: unknown
  isExpression: boolean
  expressionValue: string
}>()

const emit = defineEmits<{
  (e: 'update:value', value: unknown): void
  (e: 'update:expression', value: string): void
  (e: 'toggle'): void
}>()

const CONTROL_COMPONENTS = {
  input: InputControl,
  number: NumberControl,
  select: SelectControl,
  switch: SwitchControl,
  color: ColorControl,
}
</script>

<template>
  <div class="lc-props-row">
    <span class="lc-props-row__label">{{ props.config.label }}</span>
    <div class="lc-props-row__control">
      <ExpressionControl
        v-if="props.isExpression || props.config.control === 'expression'"
        :model-value="props.expressionValue"
        @update:model-value="emit('update:expression', $event)"
      />
      <JsonControl
        v-else-if="props.config.control === 'json'"
        :model-value="props.value"
        @update:model-value="emit('update:value', $event)"
      />
      <component
        :is="CONTROL_COMPONENTS[props.config.control as keyof typeof CONTROL_COMPONENTS] ?? InputControl"
        v-else
        :model-value="props.value"
        :options="props.config.options ?? []"
        @update:model-value="emit('update:value', $event)"
      />
    </div>
    <button
      v-if="props.config.control !== 'expression'"
      class="lc-fx-btn"
      :class="{ 'lc-fx-btn--active': props.isExpression }"
      title="切换静态值 / 表达式"
      @click="emit('toggle')"
    >
      fx
    </button>
  </div>
</template>
