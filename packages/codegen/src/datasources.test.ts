import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { generateVueSfc } from './generator'

function emptySchema(): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p1', name: '数据源', createdAt: '', updatedAt: '' },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('动态数据源', () => {
  it('rest 生成 fetch loader 与 autoLoad', async () => {
    const schema = emptySchema()
    schema.dataSources = [
      {
        id: 'remote',
        name: '远程',
        type: 'rest',
        config: { url: '/api/list', method: 'POST', params: { page: 1 } },
        autoLoad: true,
      },
    ]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('async function loadRemote()')
    expect(code).toContain("fetch('/api/list?page=1'")
    expect(code).toContain("method: 'POST'")
    expect(code).toContain('loadRemote()')
    expect(code).toContain('onMounted(')
  })

  it('localStorage 数据源读取 JSON', async () => {
    const schema = emptySchema()
    schema.dataSources = [
      { id: 'local', name: '本地', type: 'localStorage', config: { storageKey: 'k' } },
    ]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain("localStorage.getItem('k')")
    expect(code).toContain('const local = ref(')
  })

  it('DataModel 数据源 warning + 占位 ref', async () => {
    const schema = emptySchema()
    schema.dataSources = [
      { id: 'model', name: '模型', type: 'DataModel', config: { modelRef: 'm1' } },
    ]
    const { code, warnings } = await generateVueSfc(schema)
    expect(code).toContain('const model = ref(null)')
    expect(warnings.some((warning) => warning.code === 'datasource-deferred')).toBe(true)
  })
})
