import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = { resolve: () => undefined, has: () => false }

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '校验测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeContext(nodes: PageNode[]): RuntimeContext {
  return new RuntimeContext({
    schema: makeSchema(nodes),
    resolver,
    actionRegistry: new ActionRegistry(),
  })
}

function field(overrides: Partial<PageNode> = {}, props: Record<string, unknown> = {}): PageNode {
  return {
    id: 'n1',
    name: 'email',
    type: 'input',
    props: { modelValue: '', label: '邮箱', ...props },
    ...overrides,
  }
}

describe('buildFieldRules：从节点 props 推导规则', () => {
  it('无 required / validation 时没有规则', () => {
    const ctx = makeContext([field()])
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toEqual([])
  })

  it('required 的触发时机只有 blur', () => {
    const ctx = makeContext([field({}, { required: true })])
    const rules = ctx.buildFieldRules(ctx.getNode('n1')!)
    expect(rules).toHaveLength(1)
    expect(rules[0].trigger).toEqual(['blur'])
  })

  it('validation 的触发时机是 blur + change', () => {
    const ctx = makeContext([field({}, { validation: 'email' })])
    const rules = ctx.buildFieldRules(ctx.getNode('n1')!)
    expect(rules[0].trigger).toEqual(['blur', 'change'])
  })

  it('required + validation 时两条规则并存', () => {
    const ctx = makeContext([field({}, { required: true, validation: 'email' })])
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toHaveLength(2)
  })

  it('⚠️ 隐藏字段不产生任何规则', () => {
    const ctx = makeContext([field({}, { required: true, validation: 'email' })])
    ctx.setNodeHidden('n1', true)
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toEqual([])
  })

  it('schema 里 meta.hidden 为真时同样不产生规则', () => {
    const ctx = makeContext([field({ meta: { hidden: true } }, { required: true })])
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toEqual([])
  })

  it('规则读取的是**覆盖后**的配置（setRequired 立即生效）', () => {
    const ctx = makeContext([field()])
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toEqual([])
    ctx.getWidgetRef('email')!.setRequired(true)
    expect(ctx.buildFieldRules(ctx.getNode('n1')!)).toHaveLength(1)
  })
})

describe('validateField：错误写入 / 清除', () => {
  it('必填为空时报错并记录', () => {
    const ctx = makeContext([field({}, { required: true })])
    const message = ctx.validateField('n1')
    expect(message).toBe('字段值不可为空')
    expect(ctx.getFieldError('n1')).toBe(message)
  })

  it('requiredHint 作为错误文案', () => {
    const ctx = makeContext([field({}, { required: true, requiredHint: '请填写邮箱' })])
    expect(ctx.validateField('n1')).toBe('请填写邮箱')
  })

  it('⚠️ 填上值之后再校验，错误被**清除**（而不是留下过期提示）', () => {
    const ctx = makeContext([field({}, { required: true })])
    expect(ctx.validateField('n1')).toBeTypeOf('string')

    ctx.setNodeValue('n1', 'a@b.com')
    expect(ctx.validateField('n1')).toBeUndefined()
    expect(ctx.getFieldError('n1')).toBeUndefined()
  })

  it('validationHint 优先于内置默认文案', () => {
    const ctx = makeContext([
      field({}, { modelValue: 'bad', validation: 'email', validationHint: '邮箱不对' }),
    ])
    expect(ctx.validateField('n1')).toBe('邮箱不对')
  })

  it('内置校验器在空值时放行（非必填 + 邮箱格式，空输入不报错）', () => {
    const ctx = makeContext([field({}, { modelValue: '', validation: 'email' })])
    expect(ctx.validateField('n1')).toBeUndefined()
  })

  it('默认文案带 [label] 前缀', () => {
    const ctx = makeContext([field({}, { modelValue: 'bad', validation: 'email' })])
    expect(ctx.validateField('n1')).toBe('[邮箱]邮箱格式有误')
  })

  it('未命名的字段用 node.name / node.id 兜底拼文案', () => {
    const ctx = makeContext([
      { id: 'n9', type: 'input', props: { modelValue: 'bad', validation: 'email' } },
    ])
    expect(ctx.validateField('n9')).toBe('[n9]邮箱格式有误')
  })

  it('trigger 过滤：required 规则不含 change', () => {
    const ctx = makeContext([field({}, { required: true })])
    // 用 change 触发 → required 规则被过滤掉 → 无错误
    expect(ctx.validateField('n1', 'change')).toBeUndefined()
    expect(ctx.getFieldError('n1')).toBeUndefined()
    // 用 blur 触发 → required 生效
    expect(ctx.validateField('n1', 'blur')).toBeTypeOf('string')
  })

  it('trigger 过滤：validation 规则含 change', () => {
    const ctx = makeContext([field({}, { modelValue: 'bad', validation: 'email' })])
    expect(ctx.validateField('n1', 'change')).toBe('[邮箱]邮箱格式有误')
  })

  it('不存在的节点是安全的空操作', () => {
    const ctx = makeContext([field()])
    expect(ctx.validateField('missing')).toBeUndefined()
  })

  it('先命中的规则胜出（required 在前）', () => {
    const ctx = makeContext([field({}, { required: true, validation: 'email' })])
    // 值为空：required 先报，不会落到 email 规则的空值放行
    expect(ctx.validateField('n1')).toBe('字段值不可为空')
  })
})

describe('validateAll / clearFieldErrors', () => {
  const nodes: PageNode[] = [
    { id: 'a', name: 'a', type: 'input', props: { modelValue: '', label: 'A', required: true } },
    { id: 'b', name: 'b', type: 'input', props: { modelValue: 'ok', label: 'B', required: true } },
  ]

  it('任一字段不通过则返回 false，并把错误都记下来', () => {
    const ctx = makeContext(nodes)
    expect(ctx.validateAll()).toBe(false)
    expect(ctx.getFieldError('a')).toBe('字段值不可为空')
    expect(ctx.getFieldError('b')).toBeUndefined()
  })

  it('全部通过时返回 true', () => {
    const ctx = makeContext(nodes)
    ctx.setNodeValue('a', 'filled')
    expect(ctx.validateAll()).toBe(true)
  })

  it('跳过隐藏字段与无 modelValue 的节点', () => {
    const ctx = makeContext([
      ...nodes,
      { id: 't', type: 'text', props: { text: 'x' } },
    ])
    ctx.setNodeValue('a', 'filled')
    ctx.setNodeHidden('b', true)
    expect(ctx.validateAll()).toBe(true)
  })

  it('clearFieldErrors 清空全部错误（对应参考实现的 clearValidate）', () => {
    const ctx = makeContext(nodes)
    ctx.validateAll()
    expect(ctx.getFieldError('a')).toBeTypeOf('string')
    ctx.clearFieldErrors()
    expect(ctx.getFieldError('a')).toBeUndefined()
  })

  it('错误是响应式的（清除时能驱动重渲染）', () => {
    const ctx = makeContext(nodes)
    const seen: Array<string | undefined> = []
    ctx.validateField('a')
    seen.push(ctx.getFieldError('a'))
    ctx.setNodeValue('a', 'filled')
    ctx.validateField('a')
    seen.push(ctx.getFieldError('a'))
    expect(seen[0]).toBe('字段值不可为空')
    expect(seen[1]).toBeUndefined()
  })
})
