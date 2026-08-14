import { describe, expect, it } from 'vitest'
import type { PageNode } from '@lowcode/schema'
import { NodeTree } from '@lowcode/core'
import { produceWithPatches } from 'immer'

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

  it('move 支持把根级节点移入容器', () => {
    const nodes: PageNode[] = [
      { id: 'root', type: 'container', props: {}, children: ['a'] },
      { id: 'a', type: 'button', props: {} },
      { id: 'b', type: 'button', props: {} },
    ]
    const tree = new NodeTree(nodes)
    tree.move('b', { parentId: 'root', index: 0 })
    expect(tree.find('b')).toBeDefined()
    expect(tree.get('root').children).toEqual(['b', 'a'])
  })

  it('groupAs 把多个根级节点组合进容器', () => {
    const tree = new NodeTree(makeNodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }
    tree.groupAs(['a', 'b'], container)
    expect(tree.get('group1').children).toEqual(['a', 'b'])
    expect(tree.getParent('a')?.node.id).toBe('group1')
    expect(tree.getRoot().some((n) => n.id === 'group1')).toBe(true)
    expect(tree.getParent('a')).toBeDefined()
  })

  it('ungroup 把容器子节点移回根并移除容器', () => {
    const tree = new NodeTree(makeNodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }
    tree.groupAs(['a', 'b'], container)
    tree.ungroup('group1')
    expect(tree.find('group1')).toBeUndefined()
    expect(tree.getParent('a')).toBeUndefined()
    expect(tree.getParent('b')).toBeUndefined()
    const ids = tree.getRoot().map((n) => n.id)
    expect(ids).not.toContain('group1')
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  it('remove 通过 Immer draft 删除根级节点时产生补丁并真正移除节点', () => {
    const nodes: PageNode[] = [
      { id: 'root', type: 'container', props: {}, children: [] },
      { id: 'a', type: 'button', props: {} },
    ]

    const [next, patches] = produceWithPatches(nodes, (draft) => {
      new NodeTree(draft).remove('a')
    })

    expect(patches.length).toBeGreaterThan(0)
    expect(next.find((node) => node.id === 'a')).toBeUndefined()
  })

  it('move 通过 Immer draft 调整根级节点顺序时产生补丁并保留顺序', () => {
    const nodes: PageNode[] = [
      { id: 'root', type: 'container', props: {}, children: [] },
      { id: 'a', type: 'button', props: {} },
      { id: 'b', type: 'button', props: {} },
    ]

    const [next, patches] = produceWithPatches(nodes, (draft) => {
      new NodeTree(draft).move('a', { parentId: null, index: 2 })
    })

    expect(patches.length).toBeGreaterThan(0)
    expect(next.map((node) => node.id)).toEqual(['root', 'b', 'a'])
  })

  it('ungroup 通过 Immer draft 移除容器并恢复子节点为根级', () => {
    const nodes: PageNode[] = [
      { id: 'group1', type: 'container', props: {}, children: ['a', 'b'] },
      { id: 'a', type: 'button', props: {} },
      { id: 'b', type: 'button', props: {} },
    ]

    const [next, patches] = produceWithPatches(nodes, (draft) => {
      new NodeTree(draft).ungroup('group1')
    })

    expect(patches.length).toBeGreaterThan(0)
    expect(next.find((node) => node.id === 'group1')).toBeUndefined()
    expect(next.find((node) => node.id === 'a')).toBeDefined()
    expect(next.find((node) => node.id === 'b')).toBeDefined()
    expect(new NodeTree(next).getParent('a')).toBeUndefined()
    expect(new NodeTree(next).getParent('b')).toBeUndefined()
  })
})
