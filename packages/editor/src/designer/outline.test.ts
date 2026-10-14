import { describe, expect, it } from 'vitest'
import type { PageNode } from '@lowcode/schema'
import { buildOutlineTree, countOutlineNodes, findOutlineNode, outlinePathTo } from './outline'

function node(patch: Partial<PageNode> & { id: string; type: string }): PageNode {
  return { props: {}, ...patch }
}

const resolveTypeName = (type: string): string | undefined =>
  ({ container: '容器', card: '卡片', text: '文本', input: '输入框' })[type]

describe('组件层次结构树构建', () => {
  it('按 children 递归构建层级，标签优先 props.label', () => {
    const nodes: PageNode[] = [
      node({ id: 'root', name: 'root', type: 'container', children: ['card1'] }),
      node({ id: 'card1', name: 'card1', type: 'card', props: { label: '用户信息' }, children: ['t1'] }),
      node({ id: 't1', name: 'title', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('root')
    expect(tree[0].typeName).toBe('容器')
    expect(tree[0].children[0].label).toBe('用户信息')
    expect(tree[0].children[0].children[0].label).toBe('title')
    expect(countOutlineNodes(tree)).toBe(3)
  })

  it('标签回退顺序：props.label → name → 物料名', () => {
    const nodes: PageNode[] = [
      node({ id: 'a', type: 'text', props: { label: '标题' } }),
      node({ id: 'b', name: 'nickname', type: 'text' }),
      node({ id: 'c', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(tree.map((item) => item.label)).toEqual(['标题', 'nickname', '文本'])
  })

  it('具名插槽生成不可选中分组，且不与 children 重复', () => {
    const nodes: PageNode[] = [
      node({
        id: 'card1',
        type: 'card',
        children: ['body'],
        slots: { default: ['body'], footer: ['f1'] },
      }),
      node({ id: 'body', type: 'text' }),
      node({ id: 'f1', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })
    const card = tree[0]

    // children: body + footer 分组（默认插槽不再单独成组）
    expect(card.children.map((child) => child.id)).toEqual(['body', 'card1::slot::footer'])
    const footer = card.children[1]
    expect(footer.selectable).toBe(false)
    expect(footer.typeName).toBe('插槽')
    expect(footer.label).toBe('#footer')
    expect(countOutlineNodes(tree)).toBe(3)
  })

  it('被引用的节点不会重复出现在根级', () => {
    const nodes: PageNode[] = [
      node({ id: 'root', type: 'container', children: ['child'] }),
      node({ id: 'child', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('root')
  })

  it('缺失引用生成不可选中的占位节点', () => {
    const nodes: PageNode[] = [node({ id: 'root', type: 'container', children: ['ghost'] })]

    const tree = buildOutlineTree(nodes, { resolveTypeName })
    const ghost = tree[0].children[0]

    expect(ghost.type).toBe('missing')
    expect(ghost.selectable).toBe(false)
    expect(ghost.label).toContain('ghost')
    // 占位节点不计入真实组件数
    expect(countOutlineNodes(tree)).toBe(1)
  })

  it('meta.hidden 透出为 hidden 标记', () => {
    const nodes: PageNode[] = [
      node({ id: 'a', type: 'text', meta: { hidden: true } }),
      node({ id: 'b', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(tree.find((item) => item.id === 'a')?.hidden).toBe(true)
    expect(tree.find((item) => item.id === 'b')?.hidden).toBe(false)
  })

  it('重复引用同一节点时只渲染一次（防御脏 schema）', () => {
    const nodes: PageNode[] = [
      node({ id: 'root', type: 'container', children: ['a'] }),
      node({ id: 'a', type: 'container', children: ['b', 'b'] }),
      node({ id: 'b', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(countOutlineNodes(tree)).toBe(3)
  })

  it('内部结构物料显示「物料名 + 序号」而不是自动生成的节点名', () => {
    const material = (name: string) => ({
      type: 'grid-col',
      name,
      category: '布局',
      version: '1.0.0',
      hidden: true,
      defaultProps: {},
      propConfigs: [],
    })

    const tree = buildOutlineTree(
      [
        node({ id: 'g', type: 'grid-col', children: ['c1', 'c2'] }),
        node({ id: 'c1', name: 'grid-col123', type: 'grid-col' }),
        node({ id: 'c2', name: 'grid-col456', type: 'grid-col' }),
      ],
      {
        resolveTypeName: () => '栅格列',
        resolveMaterial: () => material('栅格列'),
      },
    )

    expect(tree[0].children.map((child) => child.label)).toEqual(['栅格列 1', '栅格列 2'])
  })

  it('findOutlineNode / outlinePathTo 支持按 id 定位（含插槽分组）', () => {
    const nodes: PageNode[] = [
      node({ id: 'root', type: 'card', children: ['a'], slots: { footer: ['f1'] } }),
      node({ id: 'a', type: 'text' }),
      node({ id: 'f1', type: 'text' }),
    ]

    const tree = buildOutlineTree(nodes, { resolveTypeName })

    expect(findOutlineNode(tree, 'a')?.type).toBe('text')
    expect(findOutlineNode(tree, 'root::slot::footer')?.label).toBe('#footer')
    expect(findOutlineNode(tree, 'nope')).toBeUndefined()
    expect(outlinePathTo(tree, 'f1')).toEqual(['root', 'root::slot::footer', 'f1'])
    expect(outlinePathTo(tree, 'nope')).toEqual([])
  })
})
