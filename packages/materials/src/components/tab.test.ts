// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext, RuntimeRenderer, type IComponentResolver } from '@lowcode/runtime'
import { MATERIAL_COMPONENTS } from '../materials'

// happy-dom 未实现 ResizeObserver，Element Plus 的 tabs 会用到
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

const resolver: IComponentResolver = {
  resolve: (type) => MATERIAL_COMPONENTS[type],
  has: (type) => type in MATERIAL_COMPONENTS,
}

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '标签页测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeNodes(): PageNode[] {
  return [
    {
      id: 't1',
      name: 'tab1',
      type: 'tab',
      props: { displayType: 'border-card' },
      children: ['p1', 'p2'],
    },
    {
      id: 'p1',
      name: 'pane1',
      type: 'tab-pane',
      props: { label: '第一页', paneName: 'first', active: true },
      children: ['s1'],
    },
    { id: 's1', name: 'text1', type: 'static-text', props: { textContent: '第一页内容' } },
    {
      id: 'p2',
      name: 'pane2',
      type: 'tab-pane',
      props: { label: '第二页', paneName: 'second' },
      children: ['s2'],
    },
    { id: 's2', name: 'text2', type: 'static-text', props: { textContent: '第二页内容' } },
  ]
}

describe('标签页默认激活', () => {
  it('面板显式 `active: true` 时该面板被激活（不能整片空白）', async () => {
    const nodes = makeNodes()
    const wrapper = mount(RuntimeRenderer, {
      props: { schema: makeSchema(nodes), context: new RuntimeContext({
        schema: makeSchema(nodes),
        resolver,
        actionRegistry: new ActionRegistry(),
      }) },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const panes = wrapper.findAll('.el-tab-pane')
    expect(panes).toHaveLength(2)
    expect(panes[0].attributes('aria-hidden')).not.toBe('true')
    expect(panes[1].attributes('aria-hidden')).toBe('true')
  })
})
