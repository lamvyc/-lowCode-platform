import { describe, expect, it } from 'vitest'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import { RuntimeContext, renderNode } from '@lowcode/runtime'
import type { IComponentResolver } from './resolver'

const resolver: IComponentResolver = { resolve: () => undefined, has: () => false }

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '字段 API 测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeContext(
  nodes: PageNode[],
  options: { onSetNodeProp?: (nodeId: string, prop: string, value: unknown) => void } = {},
): RuntimeContext {
  return new RuntimeContext({
    schema: makeSchema(nodes),
    resolver,
    actionRegistry: new ActionRegistry(),
    ...options,
  })
}

/** 一个典型的字段节点：有名称、默认值、选项 */
function fieldNode(overrides: Partial<PageNode> = {}): PageNode {
  return {
    id: 'n1',
    name: 'userName',
    type: 'input',
    props: {
      modelValue: 'default',
      disabled: false,
      readonly: false,
      required: false,
      label: '姓名',
    },
    ...overrides,
  }
}

describe('字段名索引与句柄查找', () => {
  it('按名称解析到节点 id', () => {
    const ctx = makeContext([fieldNode()])
    expect(ctx.resolveNodeId('userName')).toBe('n1')
  })

  it('名称未命中时把入参当节点 id', () => {
    const ctx = makeContext([{ id: 'n1', type: 'input', props: {} }])
    expect(ctx.resolveNodeId('n1')).toBe('n1')
  })

  it('都不命中返回 undefined', () => {
    const ctx = makeContext([fieldNode()])
    expect(ctx.resolveNodeId('nope')).toBeUndefined()
    expect(ctx.getWidgetRef('nope')).toBeUndefined()
  })

  it('重名时后者覆盖前者（与参考实现 refList 一致）', () => {
    const ctx = makeContext([
      { id: 'a', name: 'dup', type: 'input', props: {} },
      { id: 'b', name: 'dup', type: 'input', props: {} },
    ])
    expect(ctx.resolveNodeId('dup')).toBe('b')
  })

  it('没有 name 的节点仍可按 id 取到句柄，name 回退为 id', () => {
    const ctx = makeContext([{ id: 'lonely', type: 'input', props: {} }])
    const handle = ctx.getWidgetRef('lonely')
    expect(handle?.nodeId).toBe('lonely')
    expect(handle?.name).toBe('lonely')
  })
})

describe('取值 / 赋值 / 重置', () => {
  it('初始值来自 schema 的 modelValue', () => {
    const ctx = makeContext([fieldNode()])
    expect(ctx.getWidgetRef('userName')?.getValue()).toBe('default')
  })

  it('setValue 改值但**不动 schema**', () => {
    const ctx = makeContext([fieldNode()])
    const handle = ctx.getWidgetRef('userName')!
    handle.setValue('typed')
    expect(handle.getValue()).toBe('typed')
    expect(ctx.getNode('n1')?.props.modelValue).toBe('default')
  })

  it('resetField 恢复为 schema 默认值', () => {
    const ctx = makeContext([fieldNode()])
    const handle = ctx.getWidgetRef('userName')!
    handle.setValue('typed')
    handle.resetField()
    expect(handle.getValue()).toBe('default')
  })

  it('resetField 在从未赋值时是安全的空操作', () => {
    const ctx = makeContext([fieldNode()])
    expect(() => ctx.resetNodeValue('n1')).not.toThrow()
    expect(() => ctx.resetNodeValue('missing')).not.toThrow()
  })
})

describe('状态开关：写属性而非写值', () => {
  it('setDisabled / setReadonly / setRequired / setLabel 生效且不动 schema', () => {
    const ctx = makeContext([fieldNode()])
    const handle = ctx.getWidgetRef('userName')!
    const node = ctx.getNode('n1')!

    handle.setDisabled(true)
    handle.setReadonly(true)
    handle.setRequired(true)
    handle.setLabel('用户名')

    expect(ctx.resolveProp(node, 'disabled')).toBe(true)
    expect(ctx.resolveProp(node, 'readonly')).toBe(true)
    expect(ctx.resolveProp(node, 'required')).toBe(true)
    expect(ctx.resolveProp(node, 'label')).toBe('用户名')

    // schema 原值保持不变
    expect(node.props.disabled).toBe(false)
    expect(node.props.readonly).toBe(false)
    expect(node.props.required).toBe(false)
    expect(node.props.label).toBe('姓名')
  })

  it('setOption 是通用选项写入入口', () => {
    const ctx = makeContext([fieldNode()])
    const node = ctx.getNode('n1')!
    ctx.getWidgetRef('userName')!.setOption('placeholder', '请输入姓名')
    expect(ctx.resolveProp(node, 'placeholder')).toBe('请输入姓名')
  })

  it('提供了 onSetNodeProp 时属性写入走编辑器回调，而不是本地覆盖', () => {
    const calls: Array<[string, string, unknown]> = []
    const ctx = makeContext([fieldNode()], {
      onSetNodeProp: (nodeId, prop, value) => calls.push([nodeId, prop, value]),
    })
    ctx.getWidgetRef('userName')!.setDisabled(true)

    expect(calls).toEqual([['n1', 'disabled', true]])
    // 没有落到本地覆盖：属性写入在编辑器里应当进 schema 历史
    expect(ctx.overrides.n1?.disabled).toBeUndefined()
  })

  it('字段值**不会**走 onSetNodeProp（值不是配置，不能进 schema 历史）', () => {
    const calls: Array<[string, string, unknown]> = []
    const ctx = makeContext([fieldNode()], {
      onSetNodeProp: (nodeId, prop, value) => calls.push([nodeId, prop, value]),
    })
    ctx.getWidgetRef('userName')!.setValue('typed')

    expect(calls).toEqual([])
    expect(ctx.getNodeValue('n1')).toBe('typed')
  })
})

describe('隐藏：节点级系统属性', () => {
  it('setHidden 走 meta 通道，不污染 props', () => {
    const ctx = makeContext([fieldNode()])
    const node = ctx.getNode('n1')!

    expect(ctx.resolveHidden(node)).toBe(false)
    ctx.getWidgetRef('userName')!.setHidden(true)
    expect(ctx.resolveHidden(node)).toBe(true)

    // hidden 是节点级属性：既没写 props，也没改 schema 的 meta
    expect(node.props.hidden).toBeUndefined()
    expect(node.meta?.hidden).toBeUndefined()
  })

  it('schema 里 meta.hidden 为真时同样隐藏', () => {
    const ctx = makeContext([fieldNode({ meta: { hidden: true } })])
    expect(ctx.resolveHidden(ctx.getNode('n1')!)).toBe(true)
  })

  it('覆盖可以反向放开 schema 的隐藏', () => {
    const ctx = makeContext([fieldNode({ meta: { hidden: true } })])
    ctx.setNodeHidden('n1', false)
    expect(ctx.resolveHidden(ctx.getNode('n1')!)).toBe(false)
  })

  it('渲染器按 resolveHidden 跳过节点（覆盖生效）', () => {
    const ctx = makeContext([fieldNode()])
    expect(renderNode('n1', ctx, (_n, inner) => inner)).not.toBeNull()
    ctx.setNodeHidden('n1', true)
    expect(renderNode('n1', ctx, (_n, inner) => inner)).toBeNull()
  })
})

describe('选项操作', () => {
  function optionNode(): PageNode {
    return {
      id: 'n1',
      name: 'city',
      type: 'select',
      props: {
        optionItems: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
          { label: 'C', value: 3 },
        ],
      },
    }
  }

  it('getOptions 返回当前选项', () => {
    const ctx = makeContext([optionNode()])
    expect(ctx.getWidgetRef('city')?.getOptions()).toHaveLength(3)
  })

  it('disableOption / enableOption 按 value 生效，且不改写 schema 原数组', () => {
    const ctx = makeContext([optionNode()])
    const handle = ctx.getWidgetRef('city')!
    const node = ctx.getNode('n1')!

    handle.disableOption(2)
    let items = ctx.resolveProp(node, 'optionItems') as Array<{ value: number; disabled?: boolean }>
    expect(items.find((o) => o.value === 2)?.disabled).toBe(true)
    expect(items.find((o) => o.value === 1)?.disabled).toBeUndefined()

    // schema 原数组未被就地修改
    const raw = node.props.optionItems as Array<{ disabled?: boolean }>
    expect(raw.every((o) => o.disabled === undefined)).toBe(true)

    handle.enableOption(2)
    items = ctx.resolveProp(node, 'optionItems') as Array<{ value: number; disabled?: boolean }>
    expect(items.find((o) => o.value === 2)?.disabled).toBe(false)
  })

  it('disableOption 对不存在的 value 不产生写入', () => {
    const ctx = makeContext([optionNode()])
    ctx.getWidgetRef('city')!.disableOption(999)
    expect(ctx.overrides.n1?.optionItems).toBeUndefined()
  })

  it('loadOptions / reloadOptions 替换选项（两者行为一致）', () => {
    const ctx = makeContext([optionNode()])
    const node = ctx.getNode('n1')!
    const next = [{ label: 'X', value: 9 }]

    ctx.getWidgetRef('city')!.loadOptions(next)
    expect(ctx.resolveProp(node, 'optionItems')).toEqual(next)

    ctx.getWidgetRef('city')!.reloadOptions([{ label: 'Y', value: 8 }])
    expect(ctx.resolveProp(node, 'optionItems')).toEqual([{ label: 'Y', value: 8 }])

    // 传入数组被拷贝：外部后续改动不影响已写入的选项
    next.push({ label: 'Z', value: 10 })
    expect((ctx.overrides.n1?.optionItems as unknown[]).length).toBe(1)
  })
})

describe('样式类名', () => {
  it('addClass / removeClass 维护数组形态的 class', () => {
    const ctx = makeContext([fieldNode()])
    const handle = ctx.getWidgetRef('userName')!
    const node = ctx.getNode('n1')!

    handle.addClass('a')
    expect(ctx.resolveProp(node, 'class')).toEqual(['a'])

    handle.addClass('b')
    expect(ctx.resolveProp(node, 'class')).toEqual(['a', 'b'])

    handle.addClass('a')
    expect(ctx.resolveProp(node, 'class')).toEqual(['a', 'b']) // 幂等

    handle.removeClass('a')
    expect(ctx.resolveProp(node, 'class')).toEqual(['b'])
  })

  it('能从空格分隔的字符串形态归一化', () => {
    const ctx = makeContext([fieldNode({ props: { class: 'x y' } })])
    const handle = ctx.getWidgetRef('userName')!
    handle.addClass('z')
    expect(ctx.resolveProp(ctx.getNode('n1')!, 'class')).toEqual(['x', 'y', 'z'])
  })
})
