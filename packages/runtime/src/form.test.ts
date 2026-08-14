import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { ActionRegistry, FormEngine, JexlExpressionEngine } from '@lowcode/core'
import { SCHEMA_VERSION, type PageSchema } from '@lowcode/schema'
import { FormRenderer, RuntimeContext } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = {
  resolve: () => undefined,
  has: () => false,
}

function makeSchema(): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '表单测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeEngine(fields: FormEngine['schema']['fields']): FormEngine {
  return new FormEngine({
    schema: { fields },
    expression: new JexlExpressionEngine(),
  })
}

async function renderForm(engine: FormEngine): Promise<string> {
  const app = createSSRApp({
    render: () => h(FormRenderer, { engine }),
  })
  return renderToString(app)
}

describe('FormRenderer 表单渲染', () => {
  it('渲染字段 label 与文本输入控件', async () => {
    const html = await renderForm(
      makeEngine([
        { name: 'name', label: '姓名' },
        { name: 'age', label: '年龄' },
      ]),
    )
    expect(html).toContain('姓名')
    expect(html).toContain('年龄')
    expect(html).toContain('<input')
  })

  it('select 字段渲染选项', async () => {
    const html = await renderForm(
      makeEngine([{ name: 'status', label: '状态', widget: 'select', options: ['A', 'B'] }]),
    )
    expect(html).toContain('<option')
    expect(html).toContain('A')
    expect(html).toContain('B')
  })

  it('校验错误渲染到字段下方', async () => {
    const engine = makeEngine([{ name: 'title', label: '标题', validation: { required: true } }])
    engine.validate()
    const html = await renderForm(engine)
    expect(html).toContain('必填')
  })

  it('不可见字段不渲染', async () => {
    const html = await renderForm(
      makeEngine([
        { name: 'hidden', label: '隐藏字段', visible: 'false' },
        { name: 'shown', label: '可见字段' },
      ]),
    )
    expect(html).not.toContain('隐藏字段')
    expect(html).toContain('可见字段')
  })

  it('禁用字段渲染 disabled 属性', async () => {
    const html = await renderForm(
      makeEngine([{ name: 'code', label: '编码', disabled: 'true' }]),
    )
    expect(html).toContain('disabled')
  })

  it('未注册控件渲染占位提示', async () => {
    const html = await renderForm(
      makeEngine([{ name: 'x', label: 'X', widget: 'unknown-widget' }]),
    )
    expect(html).toContain('未注册控件')
  })
})

describe('RuntimeContext 表单注册与提交', () => {
  function makeContext(): RuntimeContext {
    return new RuntimeContext({
      schema: makeSchema(),
      resolver,
      actionRegistry: new ActionRegistry(),
    })
  }

  it('默认 submitForm 从注册表查找表单并提交', async () => {
    const context = makeContext()
    const engine = makeEngine([{ name: 'title', label: '标题', validation: { required: true } }])
    context.registerForm('form1', engine)
    const submitForm = context.createActionContext().submitForm

    await expect(submitForm?.('form1')).resolves.toEqual({ ok: false, error: '表单校验未通过' })
    engine.setValue('title', '已填写')
    await expect(submitForm?.('form1')).resolves.toEqual({ ok: true })
  })

  it('未注册表单提交返回错误', async () => {
    const context = makeContext()
    const submitForm = context.createActionContext().submitForm
    await expect(submitForm?.('missing')).resolves.toEqual({ ok: false, error: '表单未注册: missing' })
  })

  it('重复注册同一表单抛错，取消注册后可用', () => {
    const context = makeContext()
    const engine = makeEngine([])
    const off = context.registerForm('form1', engine)
    expect(() => context.registerForm('form1', makeEngine([]))).toThrow('表单已注册')
    off()
    expect(() => context.registerForm('form1', makeEngine([]))).not.toThrow()
  })
})
