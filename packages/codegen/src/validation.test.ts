import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { resolveForm } from './form'
import type { MappingContext } from './mappings/types'
import { sanitizeIdentifier } from './plan'
import {
  BUILTIN_VALIDATION_MESSAGES,
  BUILTIN_VALIDATION_PATTERNS,
  buildRulesForField,
  buildRulesObject,
} from './validation'

function makeSchema(): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '校验测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeContext(): MappingContext {
  const schema = makeSchema()
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
    modelKey: (node) => sanitizeIdentifier(node.name || node.id, node.id),
    prop: (node, name) => node.props[name],
    renderNode: () => ({ kind: 'text', value: '' }),
    renderChildren: () => [],
  }
}

function node(patch: Partial<PageNode> & { props?: Record<string, unknown> }): PageNode {
  return {
    id: 'f1',
    name: 'field1',
    type: 'input',
    props: {},
    ...patch,
  } as PageNode
}

describe('buildRulesForField', () => {
  it('required 生成必填规则与自定义文案', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(node({ props: { required: true } }), ctx)
    expect(rules.join('\n')).toContain('required: true')
    expect(rules.join('\n')).toContain('字段值不可为空')
    expect(rules.join('\n')).toContain("trigger: ['blur', 'change']")
  })

  it('requiredHint 覆盖默认文案', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(
      node({ props: { required: true, requiredHint: '请填写姓名' } }),
      ctx,
    )
    expect(rules.join('\n')).toContain('请填写姓名')
  })

  it('内置 email 生成 pattern 与默认文案', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(
      node({ props: { validation: 'email', label: '邮箱' } }),
      ctx,
    )
    expect(rules.join('\n')).toContain('pattern: /^([-_A-Za-z0-9.]+)@')
    expect(rules.join('\n')).toContain('[邮箱]邮箱格式有误')
  })

  it('自定义正则在非法时 warning 并跳过', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(node({ props: { validation: '[' } }), ctx)
    expect(rules).toEqual([])
    expect(ctx.warnings.some((warning) => warning.code === 'invalid-pattern')).toBe(true)
  })

  it('minLength/maxLength 生成 min/max 规则', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(
      node({ props: { minLength: 3, maxLength: 8 } }),
      ctx,
    )
    expect(rules.join('\n')).toContain('min: 3')
    expect(rules.join('\n')).toContain('max: 8')
  })

  it('onValidate 生成自定义 validator', () => {
    const ctx = makeContext()
    const rules = buildRulesForField(
      node({ props: { onValidate: 'if (!value) callback(new Error("必填"))' } }),
      ctx,
    )
    expect(rules.join('\n')).toContain('validator: (rule, value, callback)')
    expect(rules.join('\n')).toContain('new Error("必填")')
  })

  it('内置校验表与 core 一致', async () => {
    const core = await import('@lowcode/core')
    expect(BUILTIN_VALIDATION_PATTERNS).toEqual(core.BUILTIN_PATTERNS)
    for (const [name, buildMessage] of Object.entries(BUILTIN_VALIDATION_MESSAGES)) {
      expect(typeof buildMessage('字段')).toBe('string')
      expect(name.length).toBeGreaterThan(0)
    }
  })
})

describe('buildRulesObject', () => {
  it('按模型键输出规则，无规则字段不出现', () => {
    const ctx = makeContext()
    const nodeWithRules = node({ id: 'f1', name: 'email', props: { required: true } })
    const nodeWithout = node({ id: 'f2', name: 'nick', props: {} })
    const plan = {
      schema: makeSchema(),
      rootNodes: [nodeWithRules, nodeWithout],
      fieldNodes: [nodeWithRules, nodeWithout],
      modelKeys: new Map([
        ['f1', 'email'],
        ['f2', 'nick'],
      ]),
      warnings: [],
    }
    const object = buildRulesObject(plan, ctx)
    expect(object).toContain('email: [')
    expect(object).not.toContain('nick:')
  })
})
