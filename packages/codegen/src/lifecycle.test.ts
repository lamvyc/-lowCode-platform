import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { generateVueSfc } from './generator'

function schemaWith(nodeProps: Record<string, unknown>): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p1', name: '生命周期', createdAt: '', updatedAt: '' },
    nodes: [
      { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', ...nodeProps } },
    ],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('节点生命周期钩子', () => {
  it('onCreated / onMounted 生成并执行', async () => {
    const { code } = await generateVueSfc(
      schemaWith({
        onCreated: "this.setValue('默认')",
        onMounted: 'console.log(this.value)',
      }),
    )
    expect(code).toContain('onCreated')
    expect(code).toContain("this.setValue('默认')")
    expect(code).toContain("console.log(this.value)")
    expect(code).toContain('onMounted(')
    expect(code).toContain('formData.userName')
  })
})
