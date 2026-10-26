// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import type { EventAction } from '@lowcode/schema'
import ActionChainEditor from './ActionChainEditor.vue'

// happy-dom 未实现 ResizeObserver，Element Plus 的下拉/弹层会用到
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

afterEach(() => {
  document.body.innerHTML = ''
})

function action(overrides: Partial<EventAction> = {}): EventAction {
  return { id: 'act_1', kind: 'setProp', config: {}, ...overrides }
}

function mountEditor(actions: EventAction[]) {
  return mount(ActionChainEditor, {
    props: { modelValue: actions, eventName: 'click', widgetName: 'button' },
    attachTo: document.body,
  })
}

/** 找到「动作参数」的 textarea（其余两个输入是单行 el-input） */
function paramsTextarea(wrapper: ReturnType<typeof mountEditor>): HTMLTextAreaElement {
  const element = wrapper.find('.lc-action-chain textarea').element
  expect(element, '未找到动作参数输入框').toBeTruthy()
  return element as HTMLTextAreaElement
}

function lastActions(wrapper: ReturnType<typeof mountEditor>): EventAction[] {
  const emitted = wrapper.emitted('update:modelValue')
  expect(emitted, '动作链没有 emit update:modelValue').toBeTruthy()
  return emitted![emitted!.length - 1][0] as EventAction[]
}

describe('动作链：动作参数可输入', () => {
  it('输入过程中文本不会被受控输入回滚，合法 JSON 即时写回', async () => {
    const wrapper = mountEditor([action()])

    const textarea = paramsTextarea(wrapper)
    expect(textarea.value).toBe('{}')

    await wrapper.find('.lc-action-chain textarea').setValue('{"prop":"text","value":"hi"}')
    await flushPromises()

    // 关键回归：此前 el-input 只绑 :model-value + @change，每次按键都会被重置回 {}
    expect(paramsTextarea(wrapper).value).toBe('{"prop":"text","value":"hi"}')
    expect(lastActions(wrapper)[0].config).toEqual({ prop: 'text', value: 'hi' })

    wrapper.unmount()
  })

  it('输入半截 JSON 时保留草稿且不覆盖已有配置', async () => {
    const wrapper = mountEditor([action({ config: { prop: 'text' } })])

    await wrapper.find('.lc-action-chain textarea').setValue('{"prop":"na')
    await flushPromises()

    expect(paramsTextarea(wrapper).value).toBe('{"prop":"na')
    // 非法 JSON 不写回：不会产生新的 update
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()

    wrapper.unmount()
  })

  it('失焦时把合法 JSON 规范化并清空草稿', async () => {
    const wrapper = mountEditor([action()])

    await wrapper.find('.lc-action-chain textarea').setValue('{"prop":"text"}')
    await flushPromises()
    await wrapper.find('.lc-action-chain textarea').trigger('blur')
    await flushPromises()

    expect(lastActions(wrapper)[0].config).toEqual({ prop: 'text' })

    // 模拟父组件 v-model 回写：草稿清空后展示格式化后的配置
    await wrapper.setProps({ modelValue: lastActions(wrapper) })
    await flushPromises()
    expect(paramsTextarea(wrapper).value).toBe('{\n  "prop": "text"\n}')

    wrapper.unmount()
  })
})
