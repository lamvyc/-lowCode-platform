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
    expect(code).toContain("userName: ''")
  })

  it('前缀/后缀图标按需从 @element-plus/icons-vue 导入', async () => {
    const { code, warnings } = await generateVueSfc(
      schemaWith([fieldNode('input', { prefixIcon: 'User', suffixIcon: 'Search' })]),
    )
    expect(code).toContain("import { Search, User } from '@element-plus/icons-vue'")
    expect(code).toContain(':prefix-icon="User"')
    expect(code).toContain(':suffix-icon="Search"')
    expect(warnings.some((warning) => warning.code === 'icon-invalid')).toBe(false)
  })

  it('columnWidth 落到控件宽度', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('input', { label: '姓名', columnWidth: '200px' })]),
    )
    expect(code).toContain('width: 200px')
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

describe('字段映射 B', () => {
  it('time/date 生成对应 picker 与格式属性', async () => {
    const time = (
      await generateVueSfc(
        schemaWith([fieldNode('time', { format: 'HH:mm', valueFormat: 'HH:mm:ss' })]),
      )
    ).code
    expect(time).toContain('<el-time-picker')
    expect(time).toContain('format="HH:mm"')
    expect(time).toContain('value-format="HH:mm:ss"')

    const date = (await generateVueSfc(schemaWith([fieldNode('date', { type: 'date' })]))).code
    expect(date).toContain('<el-date-picker')
    expect(date).toContain('type="date"')
  })

  it('time-range/date-range 带 is-range', async () => {
    const timeRange = (
      await generateVueSfc(schemaWith([fieldNode('time-range', {})]))
    ).code
    expect(timeRange).toContain('<el-time-picker')
    expect(timeRange).toContain('is-range')
    const dateRange = (
      await generateVueSfc(schemaWith([fieldNode('date-range', {})]))
    ).code
    expect(dateRange).toContain('<el-date-picker')
    expect(dateRange).toContain('is-range')
  })

  it('rate 映射阈值与半星', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('rate', { max: 10, allowHalf: true, showScore: true })]),
    )
    expect(code).toContain('<el-rate')
    expect(code).toContain(':max="10"')
    expect(code).toContain('allow-half')
    expect(code).toContain('show-score')
  })

  it('color 映射 show-alpha', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('color', { showAlpha: true })]),
    )
    expect(code).toContain('<el-color-picker')
    expect(code).toContain('show-alpha')
  })

  it('slider 映射范围/垂直/步长', async () => {
    const { code } = await generateVueSfc(
      schemaWith([fieldNode('slider', { range: true, vertical: true, min: 10, max: 90, step: 5 })]),
    )
    expect(code).toContain('<el-slider')
    expect(code).toContain(':min="10"')
    expect(code).toContain(':max="90"')
    expect(code).toContain(':step="5"')
    expect(code).toContain('vertical')
  })

  it('cascader 映射 options 与多选', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        fieldNode('cascader', {
          optionItems: [{ label: 'A', value: 'a', children: [] }],
          multiple: true,
          checkStrictly: true,
        }),
      ]),
    )
    expect(code).toContain('<el-cascader')
    expect(code).toContain(':options=')
    expect(code).toContain('multiple')
    expect(code).toContain('check-strictly')
  })
})
