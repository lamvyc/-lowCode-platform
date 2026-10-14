<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { ElButton, ElDrawer, ElMessage, ElTree } from 'element-plus'
import { materialRegistry } from '../../platform'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { buildOutlineTree, countOutlineNodes, type OutlineNode } from '../outline'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { schema, state, selectNode } = ctx

/** 仅使用 el-tree 的 setCurrentKey，避免耦合具体组件类型 */
const treeRef = ref<{ setCurrentKey: (key: string | null) => void } | null>(null)

const expandAll = ref(true)
const treeKey = ref(0)

/** 组件层次结构树：children 为默认插槽，具名插槽生成不可选中的分组节点 */
const tree = computed<OutlineNode[]>(() => {
  void schema.value
  return buildOutlineTree(schema.value.nodes, {
    resolveTypeName: (type) => materialRegistry.get(type)?.name,
    resolveMaterial: (type) => materialRegistry.get(type),
  })
})

const total = computed(() => countOutlineNodes(tree.value))

function syncCurrent(): void {
  treeRef.value?.setCurrentKey(state.selectedNodeId)
}

function scrollToNode(id: string): void {
  void nextTick(() => {
    const target = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function onNodeClick(data: OutlineNode): void {
  if (!data.selectable) {
    ElMessage.info('该节点为结构分组，不能直接选中')
    return
  }
  selectNode(data.id)
  scrollToNode(data.id)
}

function toggleExpandAll(value: boolean): void {
  expandAll.value = value
  // el-tree 无展开/收起全部 API，通过重建实例切换 default-expand-all
  treeKey.value += 1
  void nextTick(syncCurrent)
}

// 打开时同步当前选中；面板打开期间选中变化也保持高亮
watch(
  () => props.modelValue,
  (open) => {
    if (open) void nextTick(syncCurrent)
  },
)
watch(
  () => state.selectedNodeId,
  () => {
    if (props.modelValue) void nextTick(syncCurrent)
  },
)

function close(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="组件层次结构树"
    direction="ltr"
    size="300px"
    :modal="false"
    append-to-body
    class="lc-node-tree-drawer"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <div class="lc-node-tree__bar">
      <span class="lc-node-tree__count">共 {{ total }} 个组件</span>
      <el-button size="small" text @click="toggleExpandAll(true)">展开全部</el-button>
      <el-button size="small" text @click="toggleExpandAll(false)">收起全部</el-button>
    </div>

    <el-tree
      v-if="tree.length > 0"
      :key="treeKey"
      ref="treeRef"
      :data="tree"
      node-key="id"
      :default-expand-all="expandAll"
      highlight-current
      :expand-on-click-node="false"
      @node-click="onNodeClick"
    >
      <template #default="{ data }">
        <span class="lc-node-tree__item" :class="{ 'lc-node-tree__item--hidden': data.hidden }">
          <span class="lc-node-tree__label">{{ data.label }}</span>
          <span class="lc-node-tree__type">{{ data.typeName }}</span>
          <span v-if="data.hidden" class="lc-node-tree__tag">已隐藏</span>
          <span v-if="data.type === 'slot'" class="lc-node-tree__tag">插槽</span>
        </span>
      </template>
    </el-tree>

    <p v-else class="lc-node-tree__empty">画布为空，先从左侧组件库拖入组件</p>

    <template #footer>
      <el-button size="small" @click="close">关闭</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.lc-node-tree__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 0 8px;
  border-bottom: 1px solid #f2f3f5;
}
.lc-node-tree__count {
  flex: 1;
  font-size: 12px;
  color: #86909c;
}
.lc-node-tree__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
}
.lc-node-tree__item--hidden .lc-node-tree__label {
  color: #c9cdd4;
  text-decoration: line-through;
}
.lc-node-tree__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2329;
}
.lc-node-tree__type {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 8px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  line-height: 16px;
}
.lc-node-tree__tag {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 8px;
  background: #fff7e8;
  color: #ff7d00;
  font-size: 10px;
  line-height: 16px;
}
.lc-node-tree__empty {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #86909c;
}
</style>
