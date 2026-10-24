import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '../generator'

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '字段测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: { form: { labelPosition: 'left', labelWidth: 120 } },
  }
}

function fieldNode(type: string, props: Record<string, unknown> = {}): PageNode {
  return {
    id: `f_${type.replace(/-/g, '_')}`,
    name: type.replace(/-/g, '_'),
    type,
    props: { label: '字段', ...props },
  }
}

const options = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
]

describe('字段映射 A', () => {
  it('input 包 form-item、v-model 指向 formData.name', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        {
          id: 'f1',
          name: 'userName',
          type: 'input',
          props: { label: '姓名', placeholder: '请输入' },
        },
      ]),
    )
    expect(code).toContain('<el-form-item')
    expect(code).toContain('label="姓名"')
    expect(code).toContain('prop="userName"')
    expect(code).toContain('v-model="formData.userName"')
    expect(code).toContain('<el-input')
    expect(code).toContain('placeholder="请输入"')
    expect(code).toContain('userName: ""')
  })

  it('textarea 输出 type=textarea 与 rows', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('textarea', { rows: 5, placeholder: '备注' })]),
    )
    expect(code).toContain('type="textarea"')
    expect(code).toContain(':rows="5"')
  })

  it('number 输出 el-input-number 与范围', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('number', { min: 1, max: 10, step: 2, precision: 1 })]),
    )
    expect(code).toContain('<el-input-number')
    expect(code).toContain(':min="1"')
    expect(code).toContain(':max="10"')
  })

  it('radio 渲染 optionItems 子节点与 buttonStyle', async () => {
    const radio = (await generateVueSfc(schemaWith([fieldNode('radio', { optionItems: options })])))
      .code
    expect(radio).toContain('<el-radio-group')
    expect(radio).toContain('<el-radio')
    expect(radio).toContain('A')

    const buttons = (
      await generateVueSfc(schemaWith([fieldNode('radio', { optionItems: options, buttonStyle: true })]))
    ).code
    expect(buttons).toContain('<el-radio-button')
  })

  it('checkbox 渲染 optionItems 子节点', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('checkbox', { optionItems: options })]),
    )
    expect(code).toContain('<el-checkbox-group')
    expect(code).toContain('<el-checkbox')
    expect(code).toContain('B')
  })

  it('select 渲染 el-option 与多选限制', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('select', { optionItems: options, multiple: true, multipleLimit: 2 })]),
    )
    expect(code).toContain('<el-select')
    expect(code).toContain('<el-option')
    expect(code).toContain('multiple')
    expect(code).toContain(':multiple-limit="2"')
  })

  it('switch 映射文案/颜色/宽度', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        fieldNode('switch', { activeText: '开', inactiveText: '关', switchWidth: 60 }),
      ]),
    )
    expect(code).toContain('<el-switch')
    expect(code).toContain('active-text="开"')
    expect(code).toContain('inactive-text="关"')
    expect(code).toContain(':width="60"')
  })
})
