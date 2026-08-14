import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ProcessViewer, topologicalLayers } from '@lowcode/runtime'
import { createProcessSchema } from '@lowcode/schema'

describe('topologicalLayers 分层', () => {
  it('线性流程按深度分层', () => {
    const schema = createProcessSchema({ id: 'p1', name: '线性' }, {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'call', type: 'apiCall', name: '取数' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'call' },
        { id: 'e2', from: 'call', to: 'end' },
      ],
    })
    const layers = topologicalLayers(schema)
    expect(layers.map((l) => l.nodes.map((n) => n.id))).toEqual([['start'], ['call'], ['end']])
    expect(layers.map((l) => l.depth)).toEqual([0, 1, 2])
  })

  it('分支流程把网关后的并列节点归入同一层', () => {
    const schema = createProcessSchema({ id: 'p2', name: '分支' }, {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'gw', type: 'condition' },
        { id: 'approve', type: 'task', name: '审批' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'gw' },
        { id: 'e2', from: 'gw', to: 'approve' },
        { id: 'e3', from: 'gw', to: 'end' },
      ],
    })
    const layers = topologicalLayers(schema)
    expect(layers.map((l) => l.nodes.map((n) => n.id))).toEqual([['start'], ['gw'], ['approve', 'end']])
  })

  it('缺少 start 节点返回空层', () => {
    const schema = createProcessSchema({ id: 'p3', name: '无 start' }, {
      nodes: [{ id: 'end', type: 'end' }],
      edges: [],
    })
    expect(topologicalLayers(schema)).toEqual([])
  })
})

describe('ProcessViewer 渲染', () => {
  it('渲染节点、高亮当前节点并显示状态', async () => {
    const schema = createProcessSchema({ id: 'p2', name: '分支' }, {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'gw', type: 'condition' },
        { id: 'approve', type: 'task', name: '审批' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'gw' },
        { id: 'e2', from: 'gw', to: 'approve' },
        { id: 'e3', from: 'gw', to: 'end' },
      ],
    })
    const app = createSSRApp({
      render: () =>
        h(ProcessViewer, { schema, currentNodeIds: ['approve'], status: 'waiting' }),
    })
    const html = await renderToString(app)

    expect(html).toContain('审批')
    expect(html).toContain('状态: waiting')
    expect(html).toContain('lc-process-node--current')
    expect(html).toContain('lc-process-arrow')
  })

  it('无当前节点时不高亮', async () => {
    const schema = createProcessSchema({ id: 'p1', name: '线性' }, {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'end', type: 'end' },
      ],
      edges: [{ id: 'e1', from: 'start', to: 'end' }],
    })
    const app = createSSRApp({
      render: () => h(ProcessViewer, { schema, status: 'completed' }),
    })
    const html = await renderToString(app)
    expect(html).not.toContain('lc-process-node--current')
    expect(html).toContain('状态: completed')
  })
})
