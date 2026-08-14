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
})
