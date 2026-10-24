import { describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  type FormSettings,
  type PageNode,
  type PageSchema,
} from '@lowcode/schema'
import { createMappingRegistry } from './mappings/registry'
import type { MappingContext } from './mappings/types'
import { buildPlan, sanitizeIdentifier } from './plan'
import {
  buildFormAttrs,
  buildFormData,
  buildFormItemAttrs,
  resolveForm,
} from './form'

function schemaWith(
  nodes: PageNode[],
  extra: { form?: Partial<FormSettings> } = {},
): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '表单测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: { form: extra.form },
  }
}

function makeContext(): MappingContext {
  const schema = schemaWith([])
  const warnings: MappingContext['warnings'] = []
  return {
    schema,
    nodes: new Map(),
    datasourceIds: [],
    variableNames: [],
    form: resolveForm(schema),
    mode: 'template',
    warnings,
    warn: (code, message, nodeId) => warnings.push({ code, message, nodeId }),
    addImport: () => {},
    modelKey: (node) => sanitizeIdentifier(node.name || node.id, node.id),
    prop: (node, name) => node.props[name],
    renderNode: () => ({ kind: 'text', value: '' }),
    renderChildren: () => [],
  }
}

describe('resolveForm', () => {
  it('表单设置缺省与自定义名字', () => {
    expect(resolveForm(schemaWith([]))).toMatchObject({
      modelName: 'formData',
      refName: 'formRef',
      rulesName: 'formRules',
      labelPosition: 'left',
      labelWidth: 80,
      size: 'default',
    })
    const form = resolveForm(
      schemaWith([], {
        form: { modelName: 'form model', refName: 'r', labelWidth: 150, labelPosition: 'top' },
      }),
    )
    expect(form.modelName).toBe('form_model')
    expect(form.labelPosition).toBe('top')
    expect(form.labelWidth).toBe(150)
  })
})

describe('buildFormData', () => {
  it('原始 schema 没有 modelValue 也生成字段初始值', () => {
    const registry = createMappingRegistry()
    registry.register('input', {
      tag: 'el-input',
      field: true,
      attrs: () => ({}),
      initialValue: () => '',
    })
    registry.register('checkbox', {
      tag: 'el-checkbox-group',
      field: true,
      attrs: () => ({}),
      initialValue: () => [],
    })
    registry.register('switch', {
      tag: 'el-switch',
      field: true,
      attrs: () => ({}),
      initialValue: () => false,
    })
    const plan = buildPlan(
      schemaWith([
        { id: 'i1', name: 'name', type: 'input', props: {} },
        { id: 'c1', name: 'tags', type: 'checkbox', props: {} },
        { id: 's1', name: 'enabled', type: 'switch', props: {} },
      ]),
      registry,
    )
    const data = buildFormData(plan, registry)
    expect(data).toContain('name: ""')
    expect(data).toContain('tags: []')
    expect(data).toContain('enabled: false')
  })

  it('显式 modelValue 优先于 initialValue', () => {
    const registry = createMappingRegistry()
    registry.register('input', {
      tag: 'el-input',
      field: true,
      attrs: () => ({}),
      initialValue: () => 'fallback',
    })
    const plan = buildPlan(
      schemaWith([{ id: 'i1', name: 'name', type: 'input', props: { modelValue: '张三' } }]),
      registry,
    )
    expect(buildFormData(plan, registry)).toContain('name: "张三"')
  })
})

describe('buildFormItemAttrs', () => {
  it('labelHidden / labelWidth / labelAlign 落到 form-item', () => {
    const ctx = makeContext()
    expect(
      buildFormItemAttrs({ id: 'f', type: 'input', props: { labelHidden: true } }, ctx),
    ).toMatchObject({ 'label-width': '0' })
    expect(
      buildFormItemAttrs(
        { id: 'f', type: 'input', props: { labelWidth: 120, labelAlign: 'right' } },
        ctx,
      ),
    ).toMatchObject({ 'label-width': '120px', class: 'lc-label-right' })
  })
})

describe('buildFormAttrs', () => {
  it('输出 ref/model/rules 与排版设置', () => {
    const form = resolveForm(schemaWith([], { form: { customClass: ['wide'] } }))
    expect(buildFormAttrs(form, true)).toMatchObject({
      ref: 'formRef',
      ':model': 'formData',
      ':rules': 'formRules',
      'label-position': 'left',
      'label-width': '80px',
      size: 'default',
      class: 'lc-page wide',
    })
  })
})
