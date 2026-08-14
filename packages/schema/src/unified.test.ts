import { describe, expect, it } from 'vitest'
import {
  EXPRESSION_CONTEXTS,
  SCHEMA_VERSION,
  STANDARD_ACTION_TYPES,
  UNIFIED_SCHEMA_VERSION,
  createApiSchema,
  createDataModelSchema,
  createPluginSchema,
  createProcessSchema,
  createUnifiedPageSchema,
  deserializeSchema,
  isSchemaEnvelope,
  migrateToUnified,
  parseSchema,
  serializeSchema,
  validateExpression,
  type ApiSchema,
  type DataModelSchema,
  type PluginSchema,
  type ProcessSchema,
  type UnifiedPageSchema,
} from '@lowcode/schema'

function makeMeta(id: string, name: string) {
  return { id, name }
}

describe('统一 Schema 骨架（P5）', () => {
  it('parseSchema 接受语义化版本号', () => {
    const schema = createUnifiedPageSchema(makeMeta('p1', '测试页'), { nodes: [] })
    expect(parseSchema(schema).version).toBe(UNIFIED_SCHEMA_VERSION)
  })

  it('parseSchema 拒绝非 semver 版本号', () => {
    const bad = createUnifiedPageSchema(makeMeta('p1', '测试页'), { nodes: [] })
    expect(() => parseSchema({ ...bad, version: '2.0' })).toThrow()
    expect(() => parseSchema({ ...bad, version: 'v2.0.0' })).toThrow()
  })

  it('parseSchema 拒绝未知 kind', () => {
    const bad = createUnifiedPageSchema(makeMeta('p1', '测试页'), { nodes: [] })
    expect(() => parseSchema({ ...bad, kind: 'Unknown' })).toThrow()
  })

  it('isSchemaEnvelope 识别五层统一结构', () => {
    const schema = createDataModelSchema(makeMeta('m1', '用户'), {
      fields: [{ name: 'id', type: 'string' }],
    })
    expect(isSchemaEnvelope(schema)).toBe(true)
    expect(isSchemaEnvelope({ version: '1.0.0', nodes: [] })).toBe(false)
  })
})

describe('标准 Action 枚举（P1）', () => {
  it('与规范枚举完全一致', () => {
    expect(STANDARD_ACTION_TYPES).toEqual([
      'navigate',
      'submit',
      'openDialog',
      'closeDialog',
      'invokeAPI',
      'dispatchEvent',
      'setState',
      'refresh',
    ])
  })
})

describe('表达式沙箱（P3）', () => {
  it('各层可用上下文变量与规范一致', () => {
    expect(EXPRESSION_CONTEXTS.Page).toEqual([
      '$state',
      '$props',
      '$global',
      '$api',
      '$route',
      '$user',
    ])
    expect(EXPRESSION_CONTEXTS.DataModel).toEqual(['$record', '$context', '$user'])
    expect(EXPRESSION_CONTEXTS.Process).toEqual(['$input', '$context', '$output', '$node'])
    expect(EXPRESSION_CONTEXTS.API).toEqual(['$request', '$headers', '$auth', '$response'])
  })

  it('拒绝 eval / new Function / 语句级控制流 / 变量声明 / 模板插值', () => {
    const banned = [
      'eval("1+1")',
      'new Function("x", "return x")',
      'if ($state.a) { $state.b }',
      'let x = 1',
      'const y = 2',
      'for (;;) {}',
      'while (true) {}',
      'return 1',
      '$state.a; $state.b',
      '`${$state.a}`',
      '$state.a => $state.b',
    ]
    for (const expr of banned) {
      expect(validateExpression(expr, 'Page').ok).toBe(false)
    }
  })

  it('拒绝未声明上下文变量，接受合法表达式', () => {
    expect(validateExpression('$datasource.userList.data', 'Page').ok).toBe(false)
    expect(
      validateExpression(
        '$state.keyword != "" && ($user.role == "admin" || $global.debug)',
        'Page',
      ).ok,
    ).toBe(true)
    expect(validateExpression('$record.salary * 12 > 100000', 'DataModel').ok).toBe(true)
    expect(validateExpression('$output.order.amount > 1000', 'Process').ok).toBe(true)
    expect(validateExpression('$request.query.keyword', 'API').ok).toBe(true)
  })
})

describe('DataModel Schema（P2）', () => {
  it('字段/关联/三级权限均可声明', () => {
    const schema = createDataModelSchema(makeMeta('user_model', '用户模型'), {
      primaryKey: 'id',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'salary', type: 'number', validation: { min: 0 } },
        { name: 'department', type: 'relation' },
      ],
      relations: [
        { name: 'department', type: 'oneToMany', ref: 'dept_model', foreignKey: 'deptId' },
      ],
      permissions: {
        table: [{ role: 'admin', action: 'full' }],
        field: [{ fieldName: 'salary', role: 'hr', action: 'readonly' }],
        operation: [{ role: 'editor', actions: ['create', 'update'] }],
      },
    })
    const parsed = parseSchema(schema) as DataModelSchema
    expect(parsed.kind).toBe('DataModel')
    expect(parsed.spec.relations?.[0]?.ref).toBe('dept_model')
    expect(parsed.spec.permissions?.operation?.[0]?.actions).toContain('update')
  })
})

describe('Process Schema（P6）', () => {
  it('声明式节点/边与分支表达式', () => {
    const schema = createProcessSchema(makeMeta('order_process', '订单流程'), {
      variables: [{ name: 'approved', type: 'boolean', defaultValue: false }],
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'fetch', type: 'apiCall', apiRef: 'get_order_api', output: '$output.order' },
        { id: 'decide', type: 'condition', expression: '$output.order.amount > 1000' },
        { id: 'end1', type: 'end' },
        { id: 'end2', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'fetch' },
        { id: 'e2', from: 'fetch', to: 'decide' },
        { id: 'e3', from: 'decide', to: 'end1', expression: '$output.order.amount > 1000' },
        { id: 'e4', from: 'decide', to: 'end2', expression: '$output.order.amount <= 1000' },
      ],
    })
    const parsed = parseSchema(schema) as ProcessSchema
    expect(parsed.kind).toBe('Process')
    expect(parsed.spec.edges).toHaveLength(4)
  })
})

describe('API Schema（P6）', () => {
  it('端点声明不包含处理逻辑', () => {
    const schema = createApiSchema(makeMeta('get_user_api', '查询用户'), {
      endpoint: '/api/users',
      method: 'GET',
      request: { query: { keyword: { type: 'string', required: false } } },
      response: { status: 200, schema: { type: 'array' } },
      auth: 'bearer',
    })
    const parsed = parseSchema(schema) as ApiSchema
    expect(parsed.kind).toBe('API')
    expect(parsed.spec.method).toBe('GET')
  })
})

describe('Plugin Schema（P4）', () => {
  it('JSON Schema 属性面板 + 自定义动作 + 插件接口', () => {
    const schema = createPluginSchema(makeMeta('chart_plugin', '图表插件'), {
      componentRegistry: {
        builtin: ['Input', 'Select'],
        custom: [
          {
            identifier: 'MyCustomChart',
            pluginInterface: 'chart-plugin',
            propertySchema: {
              type: 'object',
              properties: { title: { type: 'string' } },
              required: ['title'],
            },
          },
        ],
      },
      actionTypes: ['exportExcel'],
    })
    const parsed = parseSchema(schema) as PluginSchema
    expect(parsed.kind).toBe('Plugin')
    expect(parsed.spec.componentRegistry?.custom?.[0]?.propertySchema.type).toBe('object')
  })
})

describe('统一 Page Schema（P1/P2/P6）', () => {
  it('数据源引用外部模型 + 标准动作 + 声明式交互', () => {
    const schema = createUnifiedPageSchema(makeMeta('up1', '用户管理'), {
      route: '/users',
      nodes: [
        {
          id: 'n1',
          type: 'table',
          props: {},
          events: {
            click: [{ id: 'a1', type: 'openDialog', target: 'detailDialog' }],
          },
        },
      ],
      dataSources: [
        {
          id: 'ds1',
          type: 'DataModel',
          ref: 'user_model',
          operation: 'query',
          filter: '$state.keyword != ""',
        },
      ],
      interactions: [
        {
          id: 'r1',
          name: '筛选联动',
          trigger: 'event',
          expression: '$state.keyword != ""',
          actions: [{ id: 'a2', type: 'refresh', target: 'ds1' }],
        },
      ],
    })
    const parsed = parseSchema(schema) as UnifiedPageSchema
    expect(parsed.kind).toBe('Page')
    expect(parsed.spec.dataSources?.[0]).toMatchObject({
      type: 'DataModel',
      ref: 'user_model',
      operation: 'query',
    })
    expect(parsed.spec.nodes[0]?.events?.click[0]?.type).toBe('openDialog')
  })

  it('拒绝将数据定义内联进页面（P6）', () => {
    const schema = createUnifiedPageSchema(makeMeta('p_bad', '违规页'), {
      nodes: [{ id: 'n1', type: 'table', props: {} }],
      dataSources: [
        {
          id: 'ds1',
          type: 'DataModel',
          ref: 'user_model',
          operation: 'query',
          filter: '$datasource.userList.data', // 未声明上下文变量
        },
      ],
    })
    expect(() => parseSchema(schema)).toThrow()
  })
})

describe('序列化与迁移（P5）', () => {
  it('serializeSchema / deserializeSchema 任意 kind 往返一致', () => {
    const schema = createProcessSchema(makeMeta('p1', '流程'), {
      nodes: [{ id: 'start', type: 'start' }],
      edges: [],
    })
    const json = serializeSchema(schema)
    const restored = deserializeSchema<ProcessSchema>(json)
    expect(restored).toEqual(schema)
  })

  it('migrateToUnified 把旧版扁平 PageSchema 1.0.0 迁到统一结构 2.0.0', () => {
    const legacy = {
      version: SCHEMA_VERSION,
      meta: {
        id: 'legacy1',
        name: '旧页面',
        description: 'desc',
        route: '/legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      nodes: [
        {
          id: 'n1',
          type: 'button',
          props: { text: '提交' },
          events: {
            click: [
              {
                id: 'a1',
                kind: 'setVariable',
                label: '同步筛选值',
                config: { name: 'keyword', value: 'x' },
                when: '$state.ok',
              },
            ],
          },
        },
      ],
      materials: [{ type: 'button', version: '1.0.0' }],
      dataSources: [
        { id: 'ds1', name: '用户', type: 'rest', config: { url: '/api/users' } },
        { id: 'ds2', name: '静态', type: 'static', config: { staticData: [1, 2] } },
      ],
      variables: [],
      rules: [
        {
          id: 'r1',
          name: '规则',
          enabled: true,
          trigger: 'expression',
          condition: '$state.ok',
          actions: [{ id: 'a2', kind: 'navigate', config: { url: '/home' } }],
        },
      ],
    }
    const unified = migrateToUnified(legacy)
    expect(unified.kind).toBe('Page')
    expect(unified.version).toBe(UNIFIED_SCHEMA_VERSION)
    expect(unified.migrations?.[0]).toMatchObject({ from: '1.0.0', to: '2.0.0' })
    expect(unified.spec.route).toBe('/legacy')
    expect(unified.spec.nodes[0]?.events?.click[0]).toMatchObject({
      type: 'setState',
      params: { name: 'keyword', value: 'x' },
      expression: '$state.ok',
    })
    expect(unified.spec.dataSources?.[0]).toMatchObject({ id: 'ds1', type: 'API', ref: 'ds1' })
    expect(unified.spec.dataSources?.[1]).toMatchObject({ id: 'ds2', type: 'static' })
    expect(unified.spec.interactions?.[0]?.actions[0]?.type).toBe('navigate')
  })
})
