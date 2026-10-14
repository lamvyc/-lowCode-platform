import { describe, expect, it } from 'vitest'
import type { Material } from '@lowcode/schema'
import { MaterialRegistry, NodeFactory, createNodeId } from '@lowcode/core'

function makeMaterial(): Material {
  return {
    type: 'button',
    name: '按钮',
    category: '基础',
    version: '1.0.0',
    defaultProps: { text: '按钮', disabled: false },
    propConfigs: [
      { name: 'text', label: '文案', control: 'input', defaultValue: '按钮' },
      { name: 'disabled', label: '禁用', control: 'switch', defaultValue: false },
    ],
  }
}

describe('MaterialRegistry 物料注册表', () => {
  it('注册与查询物料', () => {
    const registry = new MaterialRegistry()
    registry.register(makeMaterial())
    expect(registry.get('button')?.name).toBe('按钮')
    expect(registry.has('button')).toBe(true)
  })

  it('重复注册同类型物料抛错', () => {
    const registry = new MaterialRegistry()
    registry.register(makeMaterial())
    expect(() => registry.register(makeMaterial())).toThrow()
  })

  it('list 支持按分类过滤', () => {
    const registry = new MaterialRegistry()
    registry.register(makeMaterial())
    registry.register({ ...makeMaterial(), type: 'input', name: '输入框', category: '表单' })
    expect(registry.list('基础')).toHaveLength(1)
    expect(registry.list()).toHaveLength(2)
  })
})

describe('NodeFactory 节点工厂', () => {
  it('createNode 应用物料默认属性并生成节点', () => {
    const registry = new MaterialRegistry()
    registry.register(makeMaterial())
    const factory = new NodeFactory(registry)
    const node = factory.create('button')
    expect(node.type).toBe('button')
    expect(node.props.text).toBe('按钮')
    expect(node.props.disabled).toBe(false)
    expect(node.id).toMatch(/^node_/)
  })

  it('createNode 允许覆盖默认属性', () => {
    const registry = new MaterialRegistry()
    registry.register(makeMaterial())
    const factory = new NodeFactory(registry)
    const node = factory.create('button', { props: { text: '覆盖' } })
    expect(node.props.text).toBe('覆盖')
    expect(node.props.disabled).toBe(false)
  })

  it('createNode 对未注册物料抛错', () => {
    const registry = new MaterialRegistry()
    expect(() => new NodeFactory(registry).create('unknown')).toThrow()
  })

  it('createNodeId 生成唯一 id', () => {
    expect(createNodeId()).not.toBe(createNodeId())
  })

  it('默认插槽由 children 承载，不写入 slots.default（否则渲染器会覆盖空数组）', () => {
    const registry = new MaterialRegistry()
    registry.register({ ...makeMaterial(), type: 'card', droppable: true, slots: ['default'] })
    const node = new NodeFactory(registry).create('card')

    expect(node.children).toEqual([])
    expect(node.slots).toBeUndefined()
  })

  it('具名插槽保留在 slots 中', () => {
    const registry = new MaterialRegistry()
    registry.register({
      ...makeMaterial(),
      type: 'panel',
      droppable: true,
      slots: ['default', 'header'],
    })
    const node = new NodeFactory(registry).create('panel')

    expect(node.children).toEqual([])
    expect(node.slots).toEqual({ header: [] })
  })

  it('声明了 defaultChildren 的非 droppable 容器也初始化 children', () => {
    const registry = new MaterialRegistry()
    registry.register({
      ...makeMaterial(),
      type: 'grid',
      droppable: false,
      slots: ['default'],
      defaultChildren: [{ type: 'grid-col', count: 2 }],
    })
    registry.register({ ...makeMaterial(), type: 'grid-col' })
    const node = new NodeFactory(registry).create('grid')

    expect(node.children).toEqual([])
    expect(node.slots).toBeUndefined()
  })
})
