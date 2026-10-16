import { describe, expect, it } from 'vitest'
import { createEmptyPageSchema } from './empty-page'
import { normalizePageSchema } from './normalize'
import { SCHEMA_VERSION, isPageSchema } from './validation/validate'

describe('空页面 schema', () => {
  it('画布初始就是空的（与参考实现一致）', () => {
    const schema = createEmptyPageSchema()
    // 这四条是"空画布"的定义。任何一条非空都意味着设计器一打开就有内容，
    // 而参考实现启动时是空的。
    expect(schema.nodes).toEqual([])
    expect(schema.materials).toEqual([])
    expect(schema.dataSources).toEqual([])
    expect(schema.variables).toEqual([])
    expect(schema.rules).toEqual([])
  })

  it('具备完整且合法的 schema 形状', () => {
    const schema = createEmptyPageSchema()
    expect(schema.version).toBe(SCHEMA_VERSION)
    expect(isPageSchema(schema)).toBe(true)
    // 最小形状必须经得起 normalize —— 否则设计器拿到手会崩
    expect(() => normalizePageSchema(schema)).not.toThrow()
  })

  it('meta 有可展示的默认值，且可被覆盖', () => {
    const plain = createEmptyPageSchema()
    expect(plain.meta.id).toBe('page')
    expect(plain.meta.name).toBe('未命名页面')
    expect(plain.meta.route).toBe('/')
    expect(Date.parse(plain.meta.createdAt)).not.toBeNaN()
    expect(plain.meta.updatedAt).toBe(plain.meta.createdAt)

    const custom = createEmptyPageSchema({ id: 'p1', name: '测试页', route: '/t' })
    expect(custom.meta).toMatchObject({ id: 'p1', name: '测试页', route: '/t' })
  })

  it('两次调用互不共享引用（避免调用方改动互相污染）', () => {
    const a = createEmptyPageSchema()
    const b = createEmptyPageSchema()
    expect(a.nodes).not.toBe(b.nodes)
    expect(a.meta).not.toBe(b.meta)
  })
})
