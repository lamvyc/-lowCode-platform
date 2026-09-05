import { describe, expect, it } from 'vitest'
import { NodeTree } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'
import { applyDuplicate, applyGroup, applyPaste, applyUngroup } from './node-ops'

function nodes(): PageNode[] {
  return [
    { id: 'root', type: 'container', props: {}, children: ['a', 'b'] },
    { id: 'a', type: 'button', props: { text: 'A' } },
    { id: 'b', type: 'container', props: {}, children: ['c'] },
    { id: 'c', type: 'input', props: {} },
  ]
}

describe('editor node-ops', () => {
  it('applyGroup 把多个节点组合进容器', () => {
    const tree = new NodeTree(nodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }

    applyGroup(tree, ['a', 'b'], container)

    expect(tree.get('group1').children).toEqual(['a', 'b'])
    expect(tree.getParent('a')?.node.id).toBe('group1')
  })

  it('applyUngroup 移除容器并恢复子节点', () => {
    const tree = new NodeTree(nodes())
    const container: PageNode = {
      id: 'group1',
      type: 'container',
      props: {},
      children: [],
    }
    applyGroup(tree, ['a', 'b'], container)

    applyUngroup(tree, 'group1')

    expect(tree.find('group1')).toBeUndefined()
    expect(tree.getParent('a')).toBeUndefined()
    expect(tree.getParent('b')).toBeUndefined()
  })

  it('applyPaste 复制粘贴时生成新 id 且不改原节点', () => {
    const tree = new NodeTree(nodes())

    const inserted = applyPaste(tree, [
      { id: 'copy', type: 'button', props: { text: '复制' } },
    ])

    expect(inserted).toHaveLength(1)
    expect(inserted[0].id).not.toBe('copy')
    expect(tree.find('copy')).toBeUndefined()
    expect(tree.find(inserted[0].id)).toBeDefined()
  })

  it('applyPaste 嵌套子树：容器与子节点一起克隆且不重复', () => {
    const tree = new NodeTree(nodes())

    const source: PageNode[] = [
      { id: 'group', type: 'container', props: {}, children: ['child'] },
      { id: 'child', type: 'text', props: { text: '子节点' } },
    ]
    const inserted = applyPaste(tree, source)

    // 只插入 group + child 两个节点，且 group 是新 id
    expect(inserted).toHaveLength(2)
    const newGroup = inserted.find((n) => n.type === 'container')
    const newChild = inserted.find((n) => n.type === 'text')
    expect(newGroup?.id).not.toBe('group')
    expect(newChild?.id).not.toBe('child')
    // 子节点挂在新的 group 下
    expect(newGroup?.children).toEqual([newChild?.id])
    expect(tree.getParent(newChild!.id)?.node.id).toBe(newGroup!.id)
    // 没有重复插入（child 只出现一次）
    const allIds = tree.getNodes().map((n) => n.id)
    expect(allIds.filter((id) => id === newChild!.id)).toHaveLength(1)
  })

  it('applyPaste 深复制时递归生成新的唯一 name', () => {
    const tree = new NodeTree(nodes())

    const inserted = applyPaste(tree, [
      { id: 'copy', type: 'card', props: { label: '卡片1' } },
    ])

    expect(inserted[0].name).toBeDefined()
    expect(inserted[0].name).not.toBe('copy')
    expect(inserted[0].props.label).toBe('卡片1')
    expect(tree.getNodes().some((n) => n.name === inserted[0].name)).toBe(true)
  })

  it('applyDuplicate 深复制子树：新 id/name、插入到源节点紧邻后方、子节点换名', () => {
    const tree = new NodeTree(nodes())

    const inserted = applyDuplicate(tree, 'b')

    // b 是容器，含子节点 c
    expect(inserted).toHaveLength(2)
    const newContainer = inserted.find((n) => n.type === 'container')!
    const newChild = inserted.find((n) => n.type === 'input')!
    expect(newContainer.id).not.toBe('b')
    expect(newContainer.name).toBeDefined()
    expect(newContainer.name).not.toBe('b')
    expect(newChild.id).not.toBe('c')
    expect(newChild.name).not.toBe('c')
    expect(newContainer.children).toEqual([newChild.id])

    // 新容器插在原 b 之后（a 和 b 属于根级 root 的 children）
    const root = tree.get('root')
    expect(root.children).toEqual(['a', 'b', newContainer.id])
    expect(tree.getParent(newContainer.id)?.node.id).toBe('root')
    expect(tree.getParent(newChild.id)?.node.id).toBe(newContainer.id)
  })

  it('applyDuplicate 根级节点插入到源节点后方', () => {
    const tree = new NodeTree([
      { id: 'x', type: 'text', props: { text: 'X' } },
      { id: 'y', type: 'text', props: { text: 'Y' } },
    ])

    applyDuplicate(tree, 'x')

    const duplicated = tree.getRoot().find((n) => n.id !== 'x' && n.id !== 'y')
    expect(duplicated).toBeDefined()
    expect(tree.getRoot().map((n) => n.id)).toEqual(['x', duplicated!.id, 'y'])
  })
})
