import { describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  UNIFIED_SCHEMA_VERSION,
  createUnifiedPageSchema,
  migrateToUnified,
  normalizePageSchema,
  parsePageSchema,
  unifiedEventToLegacy,
  type UnifiedEventAction,
} from '@lowcode/schema'

function makeLegacy() {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'legacy1',
      name: '旧页面',
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

describe('统一 Page → 旧版运行时视图适配', () => {
  it('normalizePageSchema 原样通过旧版 PageSchema', () => {
    const legacy = makeLegacy()
    expect(normalizePageSchema(legacy)).toEqual(legacy)
  })

  it('unifiedEventToLegacy 覆盖标准 Action 映射', () => {
    const cases: Array<{
      action: UnifiedEventAction
      kind: string
      config: Record<string, unknown>
    }> = [
      {
        action: { id: 'a', type: 'openDialog', target: 'd1' },
        kind: 'openDialog',
        config: { dialogId: 'd1' },
      },
      {
        action: { id: 'a', type: 'closeDialog', target: 'd1' },
        kind: 'closeDialog',
        config: { dialogId: 'd1' },
      },
      {
        action: { id: 'a', type: 'navigate', params: { route: '/home' } },
        kind: 'navigate',
        config: { route: '/home' },
      },
      {
        action: { id: 'a', type: 'dispatchEvent', params: { event: 'refresh' } },
        kind: 'emitEvent',
        config: { event: 'refresh' },
      },
      {
        action: { id: 'a', type: 'invokeAPI', target: 'ds1' },
        kind: 'request',
        config: { dataSourceId: 'ds1' },
      },
      {
        action: { id: 'a', type: 'setState', params: { name: 'keyword', value: 'x' } },
        kind: 'setVariable',
        config: { name: 'keyword', value: 'x' },
      },
      {
        action: {
          id: 'a',
          type: 'setState',
          params: { nodeId: 'n1', prop: 'text', value: 'y' },
        },
        kind: 'setProp',
        config: { nodeId: 'n1', prop: 'text', value: 'y' },
      },
      {
        action: { id: 'a', type: 'submit', params: { form: 'f1' } },
        kind: 'custom',
        config: { actionId: 'submit', form: 'f1' },
      },
      {
        action: { id: 'a', type: 'refresh', target: 'ds1' },
        kind: 'custom',
        config: { actionId: 'refresh', dataSourceId: 'ds1' },
      },
    ]
    for (const { action, kind, config } of cases) {
      const legacy = unifiedEventToLegacy(action)
      expect(legacy.kind).toBe(kind)
      expect(legacy.config).toEqual(config)
    }
  })

  it('normalizePageSchema 把统一 Page 映射为合法旧版视图', () => {
    const unified = createUnifiedPageSchema({ id: 'up1', name: '用户管理' }, {
      route: '/users',
      nodes: [
        {
          id: 'n1',
          type: 'button',
          props: { text: '提交' },
          events: {
            click: [
              { id: 'a1', type: 'openDialog', target: 'd1', expression: '$state.ok' },
            ],
          },
        },
      ],
      materials: [{ type: 'button' }],
      dataSources: [
        { id: 'ds1', type: 'static', value: [1, 2] },
        { id: 'ds2', type: 'API', ref: 'get_users' },
      ],
      variables: [{ id: 'v1', name: 'count', value: 0 }],
      interactions: [
        {
          id: 'r1',
          expression: '$state.ok',
          actions: [{ id: 'a2', type: 'refresh', target: 'ds1' }],
        },
      ],
    })
    const legacy = normalizePageSchema(unified)
    const parsed = parsePageSchema(legacy)
    expect(parsed.meta.id).toBe('up1')
    expect(parsed.nodes[0]?.events?.click[0]).toMatchObject({
      kind: 'openDialog',
      when: '$state.ok',
    })
    expect(parsed.dataSources[0]).toMatchObject({ id: 'ds1', type: 'static' })
    expect(parsed.dataSources[1]).toMatchObject({ id: 'ds2', type: 'rest' })
    expect(parsed.rules[0]?.condition).toBe('$state.ok')
    expect(parsed.settings).toBeUndefined()
  })

  it('migrateToUnified 后再 normalize 回旧版仍可被校验且动作保留', () => {
    const legacy = {
      ...makeLegacy(),
      version: SCHEMA_VERSION,
      nodes: [
        {
          id: 'n1',
          type: 'button',
          props: { text: '提交' },
          events: {
            click: [{ id: 'a1', kind: 'setVariable', config: { name: 'x', value: 1 } }],
          },
        },
      ],
    }
    const unified = migrateToUnified(legacy)
    expect(unified.version).toBe(UNIFIED_SCHEMA_VERSION)
    const round = normalizePageSchema(unified)
    expect(round.nodes[0]?.events?.click[0]?.kind).toBe('setVariable')
    expect(round.nodes[0]?.events?.click[0]?.config).toEqual({ name: 'x', value: 1 })
  })
})
