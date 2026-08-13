<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import type { PageNode } from '@lowcode/schema'
import { NodeTree } from '@lowcode/core'
import { useEditorStore } from '../store/editor'

interface OutlineRow {
  id: string
  depth: number
  parentId: string | null
  label: string
  type: string
  childrenCount: number
  locked?: boolean
}

const store = useEditorStore()

function flatten(nodes: PageNode[], depth = 0, parentId: string | null = null): OutlineRow[] {
  const rows: OutlineRow[] = []
  for (const node of nodes) {
    rows.push({
      id: node.id,
      depth,
      parentId,
      label: node.meta?.label ?? node.type,
      type: node.type,
      childrenCount: node.children?.length ?? 0,
      locked: node.meta?.locked,
    })
    const children = (node.children ?? [])
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is PageNode => Boolean(n))
    rows.push(...flatten(children, depth + 1, node.id))
  }
  return rows
}

const rows = ref<OutlineRow[]>([])

watch(
  () => store.schema?.nodes,
  (nodes) => {
    if (nodes) rows.value = flatten(nodes)
  },
  { immediate: true, deep: true },
)

function onEnd() {
  if (!store.schema) return
  const order = rows.value
  const rootIds = order.filter((row) => row.parentId === null).map((row) => row.id)
  const groups = new Map<string, string[]>()
  for (const row of order) {
    if (row.parentId) {
      const list = groups.get(row.parentId) ?? []
      list.push(row.id)
      groups.set(row.parentId, list)
    }
  }
  store.commit((draft) => {
    const tree = new NodeTree(draft.nodes)
    const rootNodes = rootIds
      .map((id) => tree.find(id))
      .filter((n): n is PageNode => Boolean(n))
    const rest = draft.nodes.filter((node) => !rootIds.includes(node.id))
    draft.nodes = [...rootNodes, ...rest]
    for (const node of draft.nodes) {
      const ids = groups.get(node.id)
      if (ids) node.children = ids
    }
  }, 'move')
}
</script>

<template>
  <aside class="lc-panel lc-panel--outline">
    <div class="lc-panel__title">节点大纲</div>
    <draggable
      v-model="rows"
      :group="{ name: 'outline' }"
      item-key="id"
      handle=".lc-outline-row"
      style="padding: 4px 0"
      @end="onEnd"
    >
      <template #item="{ element }">
        <div
          class="lc-outline-row"
          :class="{ 'lc-outline-row--selected': store.isSelected(element.id) }"
          :style="{ paddingLeft: `${12 + element.depth * 16}px` }"
          @click.stop="store.selectNode(element.id, $event.shiftKey || $event.metaKey)"
        >
          <span class="lc-outline-row__icon">
            {{ element.locked ? '🔒' : element.childrenCount ? '▸' : '•' }}
          </span>
          <span>{{ element.label }}</span>
        </div>
      </template>
    </draggable>
  </aside>
</template>
