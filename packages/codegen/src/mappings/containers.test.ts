import { describe, expect, it } from 'vitest'
import type { PageNode } from '@lowcode/schema'
import { createDefaultRegistry } from './index'
import { renderNodeToTemplate } from './test-utils'

const registry = createDefaultRegistry()

function node(patch: Partial<PageNode> & { props?: Record<string, unknown> }): PageNode {
  return { id: 'n1', type: 'text', props: {}, ...patch } as PageNode
}

describe('容器映射', () => {
  it('card 生成 el-card + header 插槽 + 折叠状态', () => {
    const card = node({
      id: 'c1',
      type: 'card',
      props: { label: '分组', showCollapse: true },
      children: ['t1'],
    })
    const out = renderNodeToTemplate(card, registry, [
      node({ id: 't1', type: 'static-text', props: { textContent: '内容' } }),
    ])
    expect(out).toContain('<el-card')
    expect(out).toContain('分组')
    expect(out).toContain('<template #header>')
    expect(out).toContain('cardCollapsed_c1')
  })

  it('card 的 hideTitle 不生成 header', () => {
    const out = renderNodeToTemplate(
      node({ id: 'c1', type: 'card', props: { label: '分组', hideTitle: true } }),
      registry,
    )
    expect(out).not.toContain('#header')
  })

  it('grid 生成 el-row，grid-col 响应式走 md/sm/xs', () => {
    const grid = renderNodeToTemplate(
      node({
        id: 'g1',
        type: 'grid',
        props: { gutter: 12, justify: 'center' },
        children: ['col1'],
      }),
      registry,
      [node({ id: 'col1', type: 'grid-col', props: { span: 12 } })],
    )
    expect(grid).toContain('<el-row')
    expect(grid).toContain(':gutter="12"')
    expect(grid).toContain('justify="center"')

    const col = renderNodeToTemplate(
      node({
        id: 'col1',
        type: 'grid-col',
        props: { responsive: true, md: 8, sm: 12, xs: 24 },
      }),
      registry,
    )
    expect(col).toContain(':md="8"')
    expect(col).toContain(':sm="12"')
    expect(col).toContain(':xs="24"')
    expect(col).not.toContain(':span=')
  })

  it('grid-col 非响应式输出 span/offset/push/pull', () => {
    const col = renderNodeToTemplate(
      node({
        id: 'col1',
        type: 'grid-col',
        props: { span: 6, offset: 2, push: 1, pull: 0 },
      }),
      registry,
    )
    expect(col).toContain(':span="6"')
    expect(col).toContain(':offset="2"')
    expect(col).toContain(':push="1"')
    expect(col).not.toContain(':pull=')
  })

  it('tab 生成 el-tabs + v-model，pane 带 label/name/disabled', () => {
    const tab = node({
      id: 'tab1',
      type: 'tab',
      props: { displayType: 'border-card', activeName: '' },
      children: ['pane1', 'pane2'],
    })
    const out = renderNodeToTemplate(tab, registry, [
      node({ id: 'pane1', type: 'tab-pane', props: { label: '第一页', disabled: false } }),
      node({ id: 'pane2', type: 'tab-pane', props: { label: '第二页', disabled: true } }),
    ])
    expect(out).toContain('<el-tabs')
    expect(out).toContain('v-model=')
    expect(out).toContain('<el-tab-pane')
    expect(out).toContain('label="第一页"')
    expect(out).toContain('disabled')
  })
})
