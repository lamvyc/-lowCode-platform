// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import {
  RuntimeContext,
  RuntimeRenderer,
  type IComponentResolver,
  type RuntimeLayoutType,
} from '@lowcode/runtime'
import { MATERIAL_COMPONENTS } from '../materials'

// happy-dom 未实现 ResizeObserver，Element Plus 的部分组件会用到
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
      name: '栅格渲染测试',
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

function makeContext(nodes: PageNode[]): RuntimeContext {
  return new RuntimeContext({
    schema: makeSchema(nodes),
    resolver,
    actionRegistry: new ActionRegistry(),
  })
}

function gridSchema(columnProps: Record<string, unknown>): PageNode[] {
  return [
    {
      id: 'g1',
      name: 'grid1',
      type: 'grid',
      props: { gutter: 12, colHeight: 120 },
      children: ['c1'],
    },
    {
      id: 'c1',
      name: 'gridCol1',
      type: 'grid-col',
      props: { span: 12, ...columnProps },
    },
  ]
}

function mountGrid(columnProps: Record<string, unknown>, layoutType?: RuntimeLayoutType) {
  const nodes = gridSchema(columnProps)
  return mount(RuntimeRenderer, {
    props: {
      schema: makeSchema(nodes),
      context: makeContext(nodes),
      ...(layoutType ? { layoutType } : {}),
    },
  })
}

describe('栅格渲染', () => {
  it('colHeight 通过 CSS 变量下传，成为每一列的高度（不是整行最小高度）', () => {
    const wrapper = mountGrid({})
    const row = wrapper.find('.el-row')
    // 参考实现的 colHeight 是逐列 height；父组件用可继承的 CSS 变量下传
    expect(row.attributes('style')).toContain('--lc-grid-col-height: 120px')
    expect(row.attributes('style')).not.toContain('min-height')
  })

  it('未设置 colHeight 时显式写 auto，避免嵌套栅格继承外层高度', () => {
    const nodes = gridSchema({})
    nodes[0].props = { gutter: 12 }
    const wrapper = mount(RuntimeRenderer, {
      props: { schema: makeSchema(nodes), context: makeContext(nodes) },
    })
    expect(wrapper.find('.el-row').attributes('style')).toContain('--lc-grid-col-height: auto')
  })

  it('非响应式：使用 span，且不输出 md/sm/xs 断点类', () => {
    const wrapper = mountGrid({ span: 12, responsive: false })
    const col = wrapper.find('.el-col')
    expect(col.classes()).toContain('el-col-12')
    expect(col.classes().some((name) => name.startsWith('el-col-md-'))).toBe(false)
    expect(col.classes().some((name) => name.startsWith('el-col-sm-'))).toBe(false)
    expect(col.classes().some((name) => name.startsWith('el-col-xs-'))).toBe(false)
  })

  it('响应式 + 设备档位：按当前档位把 md/sm/xs 换算成 span（PC/Pad/H5）', async () => {
    const wrapper = mountGrid(
      { responsive: true, md: 6, sm: 10, xs: 24 },
      'pc',
    )
    const classOf = () => wrapper.find('.el-col').classes().join(' ')
    expect(classOf()).toContain('el-col-6')

    await wrapper.setProps({ layoutType: 'pad' })
    await nextTick()
    expect(classOf()).toContain('el-col-10')

    await wrapper.setProps({ layoutType: 'h5' })
    await nextTick()
    expect(classOf()).toContain('el-col-24')
  })

  it('响应式但无设备档位：交给 Element Plus 断点（md/sm/xs 类都在）', () => {
    const wrapper = mountGrid({ responsive: true, md: 6, sm: 10, xs: 24 })
    const classes = wrapper.find('.el-col').classes()
    expect(classes).toContain('el-col-md-6')
    expect(classes).toContain('el-col-sm-10')
    expect(classes).toContain('el-col-xs-24')
  })
})
