<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { ElInput, ElMessage, ElTooltip } from 'element-plus'
import type { PageNode } from '@lowcode/schema'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'

const props = defineProps<{ node: PageNode }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

/** 当前名称：缺省回退到 id（旧 schema 兼容） */
const current = computed(() => props.node.name ?? props.node.id)
const draft = ref(current.value)

watch(current, (value) => {
  draft.value = value
})

/**
 * 提交唯一名称：
 * - 空名 / 重名都会回滚并提示；
 * - label 若仍等于旧 name（未被自定义），跟随新 name 同步。
 */
function commit(): void {
  const next = draft.value.trim()
  if (!next) {
    ElMessage.info('组件名称不能为空')
    draft.value = current.value
    return
  }
  if (next === current.value) return

  const duplicated = ctx.schema.value.nodes.some(
    (node) => node.id !== props.node.id && (node.name ?? node.id) === next,
  )
  if (duplicated) {
    ElMessage.error(`组件名称已存在：${next}`)
    draft.value = current.value
    return
  }

  const label = props.node.props.label
  const nextProps =
    typeof label === 'string' && label === current.value
      ? { ...props.node.props, label: next }
      : props.node.props
  ctx.updateNode(props.node.id, (node) => ({ ...node, name: next, props: nextProps }))
}
</script>

<template>
  <div class="lc-name-editor">
    <el-input v-model="draft" placeholder="组件唯一名称" @change="commit" @blur="commit" />
    <el-tooltip
      effect="light"
      placement="top"
      content="组件在页面内的唯一标识，事件与数据绑定通过它引用；重名会被拒绝"
    >
      <span class="lc-name-editor__help">?</span>
    </el-tooltip>
  </div>
</template>

<style scoped>
.lc-name-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lc-name-editor__help {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: help;
}
</style>
