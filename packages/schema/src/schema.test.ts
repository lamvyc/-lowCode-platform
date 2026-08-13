import { describe, expect, it } from 'vitest'
import {
  MigrationRegistry,
  createEmptySchema,
  deserializePage,
  migratePageSchema,
  parsePageSchema,
  SCHEMA_VERSION,
  serializePage,
} from '@lowcode/schema'

/** 构造一份合法的测试页面 */
function makeSchema() {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '测试页面',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [
      {
        id: 'n1',
        type: 'button',
        props: { text: '提交' },
      },
    ],
    materials: [{ type: 'button', version: '1.0.0' }],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

describe('schema 校验', () => {
  it('parsePageSchema 接受合法 schema', () => {
    const schema = parsePageSchema(makeSchema())
    expect(schema.version).toBe(SCHEMA_VERSION)
    expect(schema.nodes).toHaveLength(1)
  })

  it('parsePageSchema 拒绝缺少 nodes 的 schema', () => {
    const bad = { ...makeSchema(), nodes: undefined }
    expect(() => parsePageSchema(bad)).toThrow()
  })

  it('parsePageSchema 拒绝版本号类型错误', () => {
    const bad = { ...makeSchema(), version: 1 }
    expect(() => parsePageSchema(bad)).toThrow()
  })

  it('createEmptySchema 生成合法默认 schema', () => {
    const schema = createEmptySchema({ id: 'p2', name: '新页面' })
    expect(schema.nodes).toEqual([])
    expect(schema.materials).toEqual([])
    expect(schema.version).toBe(SCHEMA_VERSION)
  })
})

describe('schema 序列化', () => {
  it('serializePage / deserializePage 往返一致', () => {
    const source = parsePageSchema(makeSchema())
    const json = serializePage(source)
    const restored = deserializePage(json)
    expect(restored).toEqual(source)
    expect(restored.nodes[0]?.props.text).toBe('提交')
  })
})

describe('schema 迁移', () => {
  it('migratePageSchema 应用注册的迁移并提升版本', () => {
    const registry = new MigrationRegistry()
    registry.register({
      from: '0.9.0',
      to: SCHEMA_VERSION,
      migrate: (input: unknown) => {
        const schema = input as Record<string, unknown>
        return {
          ...schema,
          version: SCHEMA_VERSION,
          settings: { title: '默认标题' },
        }
      },
    })

    const oldSchema = { ...makeSchema(), version: '0.9.0' }
    const migrated = migratePageSchema(oldSchema, registry)
    expect(migrated.version).toBe(SCHEMA_VERSION)
    expect((migrated.settings as { title: string }).title).toBe('默认标题')
  })
})
