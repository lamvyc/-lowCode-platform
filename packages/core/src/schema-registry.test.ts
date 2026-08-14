import { describe, expect, it } from 'vitest'
import {
  SchemaRegistry,
} from '@lowcode/core'
import {
  createApiSchema,
  createDataModelSchema,
  createProcessSchema,
  createUnifiedPageSchema,
} from '@lowcode/schema'

describe('SchemaRegistry 五层 Schema 注册表', () => {
  it('按 metadata.id 解析 DataModel / API / Process', () => {
    const registry = new SchemaRegistry()
    const order = createDataModelSchema({ id: 'Order', name: '订单' }, {
      collection: 't_order',
      fields: [{ name: 'id', type: 'string' }],
    })
    const usersApi = createApiSchema({ id: 'get_users', name: '用户列表' }, {
      endpoint: '/api/users',
      method: 'GET',
    })
    const approval = createProcessSchema({ id: 'approval', name: '审批流' }, {
      nodes: [],
      edges: [],
    })

    registry.registerMany([order, usersApi, approval])

    expect(registry.resolveDataModel('Order')?.metadata.id).toBe('Order')
    expect(registry.resolveApi('get_users')?.spec.endpoint).toBe('/api/users')
    expect(registry.getProcess('approval')?.metadata.name).toBe('审批流')
  })

  it('Page / Plugin 信封不参与索引', () => {
    const registry = new SchemaRegistry()
    registry.register(createUnifiedPageSchema({ id: 'p1', name: '页面' }, { nodes: [] }))
    expect(registry.listDataModels()).toHaveLength(0)
    expect(registry.listApis()).toHaveLength(0)
  })

  it('未注册引用返回 undefined', () => {
    const registry = new SchemaRegistry()
    expect(registry.resolveDataModel('missing')).toBeUndefined()
    expect(registry.resolveApi('missing')).toBeUndefined()
  })
})
