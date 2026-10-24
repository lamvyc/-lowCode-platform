// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import SfcDialog from './SfcDialog.vue'

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

function schemaWithUnknown(): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p', name: '告警', createdAt: '', updatedAt: '' },
    nodes: [{ id: 'x', type: 'nope', props: {} }],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('SfcDialog warnings', () => {
  it('未知物料在弹窗里展示 warnings', async () => {
    const wrapper = mount(SfcDialog, {
      props: { modelValue: true, schema: schemaWithUnknown() },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(document.body.textContent).toContain('生成告警')
        expect(document.body.textContent).toContain('未注册物料: nope')
      },
      { timeout: 3000 },
    )
    wrapper.unmount()
  })
})
