import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '../generator'

function schemaWith(nodes: PageNode[], dataSources: PageSchema['dataSources'] = []): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '高级物料',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources,
    variables: [],
    rules: [],
  }
}

describe('data-table 映射', () => {
  it('生成 el-table + 列定义 + 表达式数据', async () => {
    const { code } = await generateVueSfc(
      schemaWith(
        [
          {
            id: 't1',
            name: 'table',
            type: 'data-table',
            props: {
              data: { type: 'expression', value: '$datasource.userList.data' },
              columns: [{ prop: 'name', label: '姓名', width: 120 }],
              stripe: true,
              border: true,
            },
          },
        ],
        [
          {
            id: 'userList',
            name: '用户',
            type: 'static',
            config: { staticData: { data: [{ name: '张三' }] } },
          },
        ],
      ),
    )
    expect(code).toContain('<el-table')
    expect(code).toContain(':data="userList?.data"')
    expect(code).toContain('<el-table-column')
    expect(code).toContain('prop="name"')
    expect(code).toContain('label="姓名"')
    expect(code).toContain('stripe')
  })
})
