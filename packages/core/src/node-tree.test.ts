import { describe, expect, it } from 'vitest'
import type { PageNode } from '@lowcode/schema'
import { NodeTree } from '@lowcode/core'

function makeNodes(): PageNode[] {
  return [
    { id: 'root', type: 'container', props: {}, children: ['a', 'b'] },
    { id: 'a', type: 'button', props: { text: 'A' } },
    { id: 'b', type: 'container', props: {}, children: ['c'] },
    { id: 'c', type: 'input', props: {} },
  ]
}

describe('NodeTree 节点树', () => {
  it('insert 向根节点追加节点', () => {
    const tree = new NodeTree([])
    tree.insert({ id: 'n1', type: 'button', props: {} }, null)
    expect(tree.getRoot()).toHaveLength(1)
    expect(tree.get('n1').type).toBe('button')
  })

  it('insert 向容器插入子节点并维护 children 引用', () => {
    const tree = new NodeTree(makeNodes())
    tree.insert({ id: 'd', type: 'button', props: {} }, 'b', undefined, 0)
    expect(tree.get('b').children).toEqual(['d', 'c'])
  })

  it('updateProps 修改节点属性', () => {
    const tree = new NodeTree(makeNodes())
    tree.updateProps('a', { text: '新文案' })
    expect(tree.get('a').props.text).toBe('新文案')
  })

  it('remove 删除节点并清理父级引用', () => {
    const tree = new NodeTree(makeNodes())
    tree.remove('c')
    expect(tree.find('c')).toBeUndefined()
    expect(tree.get('b').children).toEqual([])
  })

  it('move 跨容器移动节点', () => {
    const tree = new NodeTree(makeNodes())
    tree.move('a', { parentId: 'b', slot: undefined, index: 0 })
    expect(tree.find('a')?.id).toBe('a')
    expect(tree.get('root').children).toEqual(['b'])
    expect(tree.get('b').children).toEqual(['a', 'c'])
    expect(tree.getParent('a')?.node.id).toBe('b')
  })

  it('move 支持 beforeId 排序', () => {
    const tree = new NodeTree(makeNodes())
    tree.move('c', { parentId: 'root', beforeId: 'a' })
    expect(tree.get('root').children).toEqual(['c', 'a', 'b'])
  })

  it('move 禁止移动到自身后代', () => {
    const tree = new NodeTree(makeNodes())
    const result = tree.canMove('b', { parentId: 'c' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('后代')
  })

  it('getPath 返回从根到节点的路径', () => {
    const tree = new NodeTree(makeNodes())
    expect(tree.getPath('c')).toEqual(['b', 'c'])
  })

  it('isDescendant 判断祖先关系', () => {
    const tree = new NodeTree(makeNodes())
    expect(tree.isDescendant('c', 'b')).toBe(true)
    expect(tree.isDescendant('b', 'c')).toBe(false)
  })
})
