import { describe, expect, it } from 'vitest'
import { NodeTree } from '@lowcode/core'
import type { PageNode } from '@lowcode/schema'
import { applyGroup, applyPaste, applyUngroup } from './node-ops'

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
})
