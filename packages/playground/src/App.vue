<script setup lang="ts">
import { Designer } from '@lowcode/editor'
import { createEmptyPageSchema } from '@lowcode/schema'

/**
 * 画布初始为空（与参考实现一致：启动时只显示"从左侧拖入或点击组件"的空态）。
 *
 * ⚠️ 这里**不要**再注入演示 schema。此前注入的「用户管理示例」会让"新打开设计器"
 * 看到一个已经搭好的页面，既不忠实于参考实现，也容易让人误以为节点是自动生成的。
 * 需要演示能力就走「页面模板」标签页（templateRegistry）。
 */
const schema = createEmptyPageSchema({ id: 'playground', name: '未命名页面' })
</script>

<template>
  <Designer :schema="schema" />
</template>
