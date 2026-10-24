// @vitest-environment happy-dom
/**
 * 生成的代码**交互**是否可用。
 *
 * 用真实挂载 + 真实 click 验证：事件绑定、navigate 动作、v-model、
 * 以及 onCreated / onMounted 钩子。观察点用 `location.hash` 和 ElForm 的 model，
 * 确定、无需网络。
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '@lowcode/codegen'
import { mountGeneratedSfc } from './generated-harness'

afterEach(() => {
  location.hash = ''
})

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p', name: '交互', createdAt: '', updatedAt: '' },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function buttonWithAction(withAction: boolean): PageNode {
  return {
    id: 'n1',
    name: 'goBtn',
    type: 'button',
    props: { label: '去详情' },
    events: withAction
      ? {
          click: [{ id: 'a1', kind: 'navigate', config: { route: '#/detail' } }],
        }
      : undefined,
  }
}

describe('生成的代码交互可用', () => {
  it('按钮渲染出来，且绑了 click 处理函数', async () => {
    const { code } = await generateVueSfc(schemaWith([buttonWithAction(true)]))
    const { wrapper } = await mountGeneratedSfc(code)
    expect(wrapper.find('button').exists()).toBe(true)
    expect(code).toContain('@click="onClick_n1"')
  })

  it('点击按钮真的触发 navigate（location.hash 变化）', async () => {
    const { code } = await generateVueSfc(schemaWith([buttonWithAction(true)]))
    const { wrapper } = await mountGeneratedSfc(code)
    await wrapper.find('button').trigger('click')
    expect(location.hash).toBe('#/detail')
  })

  it('没有动作的按钮点一下什么也不发生（也不报错）', async () => {
    const { code } = await generateVueSfc(schemaWith([buttonWithAction(false)]))
    const { wrapper } = await mountGeneratedSfc(code)
    expect(() => wrapper.find('button').trigger('click')).not.toThrow()
    expect(location.hash).toBe('')
  })

  it('输入框可以填写并保持（v-model 写回 formData）', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        {
          id: 'input1',
          name: 'userName',
          type: 'input',
          props: { label: '姓名', modelValue: '默认值' },
        },
      ]),
    )
    const { wrapper } = await mountGeneratedSfc(code)
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('默认值')
    await input.setValue('张三')
    expect(wrapper.findComponent({ name: 'ElForm' }).props('model')).toEqual({
      userName: '张三',
    })
  })

  it('onCreated / onMounted 会被执行', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        {
          id: 'input1',
          name: 'userName',
          type: 'input',
          props: {
            label: '姓名',
            onCreated: "this.setValue('created')",
            onMounted: "this.setValue(this.value + '-mounted')",
          },
        },
      ]),
    )
    const { wrapper } = await mountGeneratedSfc(code)
    expect(wrapper.findComponent({ name: 'ElForm' }).props('model')).toEqual({
      userName: 'created-mounted',
    })
  })
})
