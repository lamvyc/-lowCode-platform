<script setup lang="ts">
import { Designer } from '@lowcode/editor'
import { createDemoSchema } from './demo-schema'

const schema = createDemoSchema()
</script>

<template>
  <Designer :schema="schema" />
</template>
