// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '@lowcode/codegen'
import { mountGeneratedSfc } from './generated-harness'

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '挂载测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: { form: { labelPosition: 'left', labelWidth: 80 } },
  }
}

describe('生成的代码能运行', () => {
  it('表单 label、初始值与必填规则真实到达 ElForm', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
      ]),
    )
    const { wrapper } = await mountGeneratedSfc(code)
    expect(wrapper.text()).toContain('姓名')
    const form = wrapper.findComponent({ name: 'ElForm' })
    expect(form.props('labelWidth')).toBe('80px')
    expect(form.props('model')).toEqual({ userName: '' })
    expect(form.props('rules')).toMatchObject({
      userName: [{ required: true, message: '字段值不可为空' }],
    })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('')

    // ⚠️ happy-dom 下 ElForm.validate() 汇总会丢失 fields（手写最简表单同样复现），
    // 这里退到字段级验证：规则能到达 ElForm，空值确实被拒绝。
    const field = (form.vm as unknown as {
      fields: Array<{ validate: (trigger: string) => Promise<boolean> }>
    }).fields[0]
    await expect(field.validate('')).rejects.toBeUndefined()
  })

  it('输入后 v-model 写回 ElForm 的 model', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
      ]),
    )
    const { wrapper } = await mountGeneratedSfc(code)
    const input = wrapper.find('input')
    await input.setValue('张三')
    expect((input.element as HTMLInputElement).value).toBe('张三')
    expect(wrapper.findComponent({ name: 'ElForm' }).props('model')).toEqual({ userName: '张三' })
  })
})
