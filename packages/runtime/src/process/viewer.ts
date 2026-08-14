import { defineComponent, h, type PropType, type VNode } from 'vue'
import type { ProcessSchema } from '@lowcode/schema'
import { topologicalLayers } from './layout'

/**
 * 流程视图：按拓扑层级纵向渲染节点卡片，高亮当前节点并显示状态。
 * 不依赖图形库；节点卡片 + 层级箭头给出轻量流程图。
 */
export const ProcessViewer = defineComponent({
  name: 'ProcessViewer',
  props: {
    schema: { type: Object as PropType<ProcessSchema>, required: true },
    /** 当前激活节点 id（如 ProcessEngine.getCurrentNodeIds()） */
    currentNodeIds: { type: Array as PropType<string[]>, default: () => [] },
    status: { type: String, default: 'idle' },
  },
  setup(props) {
    return () => {
      const layers = topologicalLayers(props.schema)
      const current = new Set(props.currentNodeIds)

      const children: VNode[] = [
        h('div', { class: 'lc-process__status' }, `状态: ${props.status}`),
      ]
      layers.forEach((layer, index) => {
        children.push(
          h(
            'div',
            { class: 'lc-process-layer' },
            layer.nodes.map((node) => {
              const isCurrent = current.has(node.id)
              return h(
                'div',
                {
                  class: ['lc-process-node', isCurrent ? 'lc-process-node--current' : ''],
                  'data-node-id': node.id,
                },
                [
                  h('span', { class: 'lc-process-node__name' }, node.name ?? node.id),
                  h('span', { class: 'lc-process-node__type' }, node.type),
                ],
              )
            }),
          ),
        )
        if (index < layers.length - 1) {
          children.push(h('div', { class: 'lc-process-arrow' }, '↓'))
        }
      })

      return h('div', { class: 'lc-process' }, children)
    }
  },
})
