// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import Designer from '../Designer.vue'

// happy-dom 未实现 ResizeObserver，Element Plus 的部分组件会用到
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '画布冒烟',
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

/**
 * 画布渲染冒烟测试。
 *
 * 存在的理由：`Canvas.vue` / `Designer.vue` 此前**没有任何测试挂载过**——
 * editor 的用例全是在 node 环境里测引擎纯函数。而渲染器一旦为字段节点包上
 * `FieldContextProvider`、给画布加 `designMode`，画布是否还能正常渲染就完全没人验证。
 * 这里只断言"能渲染出来、没有渲染错误"，把这类低级回归挡住。
 */
describe('设计器画布渲染（冒烟）', () => {
  it('挂载后三栏出现，且节点在画布中渲染出来', () => {
    const wrapper = mount(Designer, {
      props: {
        schema: makeSchema([
          { id: 't1', name: 'title', type: 'text', props: { text: '画布冒烟文本' } },
          {
            id: 'f1',
            name: 'userName',
            type: 'input',
            props: { modelValue: '', label: '姓名', placeholder: '请输入姓名' },
          },
        ]),
      },
    })

    // 设计器主体与三栏
    expect(wrapper.find('.lc-designer').exists()).toBe(true)
    expect(wrapper.find('.lc-designer__body').exists()).toBe(true)

    // 画布与运行时根节点
    expect(wrapper.find('.lc-runtime-root').exists()).toBe(true)

    // 节点确实渲染出来了
    expect(wrapper.text()).toContain('画布冒烟文本')
    expect(wrapper.find('.lc-runtime-root input').exists()).toBe(true)

    // 渲染没有降级成错误占位
    expect(wrapper.find('.lc-render-error').exists()).toBe(false)
    expect(wrapper.find('.lc-missing').exists()).toBe(false)
  })

  it('字段节点被 FieldContextProvider 包裹后仍能正常渲染与交互', async () => {
    const wrapper = mount(Designer, {
      props: {
        schema: makeSchema([
          {
            id: 'f1',
            name: 'userName',
            type: 'input',
            props: { modelValue: 'init', label: '姓名' },
          },
        ]),
      },
    })

    const input = wrapper.find('.lc-runtime-root input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('init')
  })

  it('空画布显示空状态而不是报错', () => {
    const wrapper = mount(Designer, { props: { schema: makeSchema([]) } })
    expect(wrapper.find('.lc-canvas__empty').exists()).toBe(true)
    expect(wrapper.find('.lc-render-error').exists()).toBe(false)
  })
})
