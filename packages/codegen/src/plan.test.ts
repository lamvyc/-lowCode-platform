import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { createMappingRegistry } from './mappings/registry'
import { buildPlan } from './plan'

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '计划测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('buildPlan', () => {
  it('按 mapping.field 判定字段，不依赖 modelValue', () => {
    const registry = createMappingRegistry()
    registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}) })
    const plan = buildPlan(
      schemaWith([
        { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名' } },
        { id: 'b1', name: 'btn', type: 'button', props: { label: '提交' } },
      ]),
      registry,
    )
    expect(plan.fieldNodes.map((node) => node.id)).toEqual(['f1'])
    expect(plan.modelKeys.get('f1')).toBe('userName')
  })

  it('根节点排除 children 与 slots 引用', () => {
    const registry = createMappingRegistry()
    registry.register('card', { tag: 'el-card', attrs: () => ({}), field: false })
    const plan = buildPlan(
      schemaWith([
        { id: 'a', type: 'card', props: {}, children: ['b'], slots: { extra: ['c'] } },
        { id: 'b', type: 'text', props: {} },
        { id: 'c', type: 'text', props: {} },
      ]),
      registry,
    )
    expect(plan.rootNodes.map((node) => node.id)).toEqual(['a'])
  })

  it('未知物料产生 warning，不抛错', () => {
    const plan = buildPlan(
      schemaWith([{ id: 'x', type: 'nope', props: {} }]),
      createMappingRegistry(),
    )
    expect(plan.warnings[0]).toMatchObject({ code: 'unknown-material', nodeId: 'x' })
  })

  it('模型键保留合法 name，非法/重复时回退 id 并 warning', () => {
    const registry = createMappingRegistry()
    registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}) })
    const plan = buildPlan(
      schemaWith([
        { id: 'f1', name: 'user name', type: 'input', props: {} },
        { id: 'f2', name: 'dup', type: 'input', props: {} },
        { id: 'f3', name: 'dup', type: 'input', props: {} },
      ]),
      registry,
    )
    expect(plan.modelKeys.get('f1')).toBe('user_name')
    expect(plan.modelKeys.get('f3')).toBe('f3')
    expect(plan.warnings.some((warning) => warning.code === 'model-key')).toBe(true)
  })
})
