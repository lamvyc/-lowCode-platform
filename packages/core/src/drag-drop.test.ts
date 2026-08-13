import { describe, expect, it } from 'vitest'
import type { PageNode } from '@lowcode/schema'
import { DragDropManager, NodeTree } from '@lowcode/core'

function makeTree(): NodeTree {
  const nodes: PageNode[] = [
    { id: 'root', type: 'container', props: {}, children: ['a', 'b'] },
    { id: 'a', type: 'button', props: {} },
    { id: 'b', type: 'container', props: {}, children: ['c'] },
    { id: 'c', type: 'button', props: {} },
  ]
  return new NodeTree(nodes)
}

const rect = { left: 0, top: 0, width: 200, height: 200 }

describe('DragDropManager 拖拽落点计算', () => {
  it('指针位于节点上半部时落点为 before', () => {
    const manager = new DragDropManager()
    const tree = makeTree()
    const target = manager.computeDropTarget(
      tree,
      { source: 'material', materialType: 'button' },
      { node: tree.get('a'), rect, depth: 0 },
      { x: 100, y: 20 },
    )
    expect(target.position).toBe('before')
    expect(target.targetId).toBe('a')
  })

  it('指针位于节点中部且物料可容纳子节点时落点为 inside', () => {
    const manager = new DragDropManager()
    const tree = makeTree()
    const target = manager.computeDropTarget(
      tree,
      { source: 'material', materialType: 'input' },
      { node: tree.get('b'), rect, depth: 1 },
      { x: 100, y: 100 },
    )
    expect(target.position).toBe('inside')
    expect(target.parentId).toBe('b')
  })

  it('指针位于节点下半部时落点为 after', () => {
    const manager = new DragDropManager()
    const tree = makeTree()
    const target = manager.computeDropTarget(
      tree,
      { source: 'material', materialType: 'button' },
      { node: tree.get('a'), rect, depth: 0 },
      { x: 100, y: 190 },
    )
    expect(target.position).toBe('after')
    expect(target.targetId).toBe('a')
  })

  it('画布空白处落点为根节点', () => {
    const manager = new DragDropManager()
    const tree = makeTree()
    const target = manager.computeDropTarget(
      tree,
      { source: 'material', materialType: 'button' },
      null,
      { x: 500, y: 500 },
      rect,
    )
    expect(target.position).toBe('root')
    expect(target.parentId).toBeNull()
  })

  it('validateDrop 阻止节点移动到自身后代', () => {
    const manager = new DragDropManager()
    const tree = makeTree()
    const result = manager.validateDrop(tree, { source: 'canvas', nodeId: 'b' }, {
      parentId: 'c',
      position: 'inside',
      index: 0,
    })
    expect(result.ok).toBe(false)
  })
})
