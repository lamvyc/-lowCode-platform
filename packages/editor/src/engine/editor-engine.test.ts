import { describe, expect, it } from 'vitest'
import {
  ActionRegistry,
  DragDropManager,
  MaterialRegistry,
  NodeFactory,
  type Material,
} from '@lowcode/core'
import { SCHEMA_VERSION, type PageSchema } from '@lowcode/schema'
import { EditorEngine } from './editor-engine'

function cardMaterial(): Material {
  return {
    type: 'card',
    name: '卡片',
    category: '布局',
    version: '1.0.0',
    defaultProps: { label: '', collapsed: false },
    propConfigs: [],
    droppable: true,
    slots: ['default'],
  }
}

function inputMaterial(): Material {
  return {
    type: 'input',
    name: '单行输入',
    category: '基础字段',
    version: '1.0.0',
    defaultProps: {
      label: '',
      modelValue: '',
      disabled: false,
      placeholder: '',
      required: false,
    },
    propConfigs: [],
  }
}

function gridMaterials(): Material[] {
  return [
    {
      type: 'grid',
      name: '栅格',
      category: '容器',
      version: '1.0.0',
      defaultProps: { gutter: 12, colHeight: null },
      propConfigs: [],
      droppable: false,
      slots: ['default'],
      defaultChildren: [{ type: 'grid-col', count: 2 }],
    },
    {
      type: 'grid-col',
      name: '栅格列',
      category: '容器',
      version: '1.0.0',
      defaultProps: { span: 12, offset: 0, push: 0, pull: 0, responsive: false, md: 12, sm: 12, xs: 12 },
      propConfigs: [],
      droppable: true,
      slots: ['default'],
    },
  ]
}

function makeEngine(schema?: PageSchema, materials: Material[] = [cardMaterial()]): EditorEngine {
  const registry = new MaterialRegistry()
  for (const material of materials) registry.register(material)
  const base: PageSchema = {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '测试',
      createdAt: '',
      updatedAt: '',
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
  return new EditorEngine({
    schema: schema ?? base,
    nodeFactory: new NodeFactory(registry),
    dragDropManager: new DragDropManager(),
    runtime: {
      resolver: { resolve: () => undefined, has: () => false },
      actionRegistry: new ActionRegistry(),
    },
  })
}

describe('EditorEngine 卡片容器交互', () => {
  it('insertMaterial 生成唯一 name；label 兜底成类型名（不是 name）', () => {
    const engine = makeEngine()
    const first = engine.insertMaterial('card', { parentId: null, position: 'root', index: 0 })
    const second = engine.insertMaterial('card', { parentId: null, position: 'root', index: 1 })

    expect(first.name).toMatch(/^card\d{6}/)
    expect(second.name).toBeDefined()
    expect(second.name).not.toBe(first.name)

    // ⚠️ 这里曾经断言 `label === name`（得到 `card330163` 这种带随机后缀的标签）。
    // 那是错的：参考实现 `designer.js: copyNewFieldWidget()` 的规则是
    //   options.label = options.label || type.toLowerCase()
    // 实测参考的属性面板：name=input23761、label=input。
    // 旧断言把错误行为固化了下来——"测试全绿"并不等于"行为正确"。
    expect(first.props.label).toBe('card')
    expect(second.props.label).toBe('card')
  })

  it('插入卡片后子组件可挂在卡片下', () => {
    const engine = makeEngine()
    const card = engine.insertMaterial('card', { parentId: null, position: 'root', index: 0 })

    const child = engine.insertMaterial('card', {
      parentId: card.id,
      slot: 'default',
      position: 'inside',
      index: 0,
    })

    const nodes = engine.current.nodes
    const cardNode = nodes.find((n) => n.id === card.id)!
    expect(cardNode.children).toEqual([child.id])
  })

  it('moveNodeUp / moveNodeDown 只做同级移动', () => {
    const engine = makeEngine({
      version: SCHEMA_VERSION,
      meta: { id: 'p1', name: '测试', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'root', type: 'card', props: {}, children: ['a', 'b', 'c'] },
        { id: 'a', type: 'card', props: {} },
        { id: 'b', type: 'card', props: {} },
        { id: 'c', type: 'card', props: {} },
      ],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    })

    engine.moveNodeUp('c')
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual(['a', 'c', 'b'])

    engine.moveNodeUp('a')
    // 已处于首位，不能再上移
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual(['a', 'c', 'b'])

    engine.moveNodeDown('a')
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual(['c', 'a', 'b'])
  })

  it('moveNodeUp / moveNodeDown 跳过画布上不渲染的兄弟节点', () => {
    const engine = makeEngine({
      version: SCHEMA_VERSION,
      meta: { id: 'p1', name: '测试', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'root', type: 'card', props: {}, children: ['a', 'hidden', 'c'] },
        { id: 'a', type: 'card', props: {} },
        { id: 'hidden', type: 'card', props: {} },
        { id: 'c', type: 'card', props: {} },
      ],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    })
    const isVisible = (id: string): boolean => id !== 'hidden'
    const children = (): unknown => engine.current.nodes.find((n) => n.id === 'root')!.children

    // c 上方的直接兄弟 hidden 不可见，应直接跨过它排到 a 之前（一个可见位置）
    engine.moveNodeUp('c', isVisible)
    expect(children()).toEqual(['c', 'a', 'hidden'])
    expect(engine.canMoveUp('c', isVisible)).toBe(false)

    // 下移同理：跨过 hidden，排到 a 之后
    engine.moveNodeDown('c', isVisible)
    expect(children()).toEqual(['a', 'c', 'hidden'])
    expect(engine.canMoveDown('c', isVisible)).toBe(false)

    // 无可见兄弟时两个方向都不可移动
    expect(engine.canMoveUp('a', () => false)).toBe(false)
    expect(engine.canMoveDown('a', () => false)).toBe(false)
  })

  it('duplicate 复制完整子树：新 id/name、自动插入并保留 label', () => {
    const engine = makeEngine({
      version: SCHEMA_VERSION,
      meta: { id: 'p1', name: '测试', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'root', type: 'card', props: {}, children: ['card1'] },
        { id: 'card1', type: 'card', props: { label: '卡片1' }, children: ['inner'] },
        { id: 'inner', type: 'card', props: { label: '内部' } },
      ],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    })

    const inserted = engine.duplicate('card1')

    expect(inserted).toHaveLength(2)
    const copy = inserted[0]
    const copyChild = inserted[1]
    expect(copy.id).not.toBe('card1')
    expect(copy.name).toBeDefined()
    expect(copy.name).not.toBe('card1')
    expect(copy.props.label).toBe('卡片1')
    expect(copyChild.name).not.toBe('inner')
    expect(copy.children).toEqual([copyChild.id])
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual([
      'card1',
      copy.id,
    ])
  })
})

describe('EditorEngine 表单设置', () => {
  it('updateFormSettings 合并写入且保留其他 settings 字段', () => {
    const engine = makeEngine()
    engine.updateSettings({ title: '订单页', layout: { mode: 'free' } })

    engine.updateFormSettings({ size: 'small', labelWidth: 120 })
    engine.updateFormSettings({ labelPosition: 'left' })

    expect(engine.current.settings).toEqual({
      title: '订单页',
      layout: { mode: 'free' },
      form: { size: 'small', labelWidth: 120, labelPosition: 'left' },
    })
  })

  it('updateFormSettings 连续写入合并为一条历史（可一次撤销）', () => {
    const engine = makeEngine()
    engine.updateFormSettings({ size: 'small' })
    engine.updateFormSettings({ modelName: 'orderForm' })

    expect(engine.current.settings?.form).toEqual({ size: 'small', modelName: 'orderForm' })
    expect(engine.canUndo).toBe(true)

    engine.undo()
    expect(engine.current.settings?.form).toBeUndefined()
  })

  it('resetFormSettings 仅清空 form，保留页面其他设置', () => {
    const engine = makeEngine()
    engine.updateSettings({ title: '订单页' })
    engine.updateFormSettings({ size: 'large' })

    engine.resetFormSettings()

    expect(engine.current.settings).toEqual({ title: '订单页' })
    // 无 form 时重置为空操作，不产生多余历史
    const depthBefore = engine.canUndo
    engine.resetFormSettings()
    expect(engine.current.settings).toEqual({ title: '订单页' })
    expect(engine.canUndo).toBe(depthBefore)
  })

  it('updateEvents 写入动作链并可撤销', () => {
    const engine = makeEngine()
    const card = engine.insertMaterial('card', { parentId: null, position: 'root', index: 0 })

    engine.updateEvents(card.id, {
      click: [{ id: 'a1', kind: 'openDialog', config: { dialogId: 'd1' } }],
    })
    expect(engine.current.nodes.find((n) => n.id === card.id)!.events?.click).toHaveLength(1)

    engine.updateEvents(card.id, undefined)
    expect(engine.current.nodes.find((n) => n.id === card.id)!.events).toBeUndefined()
  })
})

describe('EditorEngine 拖拽落点', () => {
  function listEngine(): EditorEngine {
    return makeEngine({
      version: SCHEMA_VERSION,
      meta: { id: 'p1', name: '测试', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'root', type: 'card', props: {}, children: ['a', 'hidden', 'c'] },
        { id: 'a', type: 'card', props: {} },
        { id: 'hidden', type: 'card', props: {}, meta: { hidden: true } },
        { id: 'c', type: 'card', props: {} },
      ],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    })
  }

  it('insertMaterial 优先按 beforeId 定位（DOM 中隐藏节点不参与测量）', () => {
    const engine = listEngine()

    // 画布上可见子节点只有 a / c，插到 c 之前对应 schema 下标 2
    const inserted = engine.insertMaterial('card', {
      parentId: 'root',
      position: 'inside',
      index: 1,
      beforeId: 'c',
    })

    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual([
      'a',
      'hidden',
      inserted.id,
      'c',
    ])
  })

  it('moveNode 按 beforeId 落点，同容器移动不产生下标偏移', () => {
    const engine = listEngine()

    // 把 c 移到 a 之前
    engine.moveNode('c', { parentId: 'root', position: 'inside', index: 0, beforeId: 'a' })
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual([
      'c',
      'a',
      'hidden',
    ])

    // 再追加到末尾
    engine.moveNode('c', { parentId: 'root', position: 'inside', index: 3 })
    expect(engine.current.nodes.find((n) => n.id === 'root')!.children).toEqual([
      'a',
      'hidden',
      'c',
    ])
  })
})

describe('EditorEngine 外部 Schema 默认值归一', () => {
  it('载入时补齐物料默认属性，字段能被校验、禁用覆盖能生效', () => {
    const schema: PageSchema = {
      version: SCHEMA_VERSION,
      meta: { id: 'p1', name: '默认值', createdAt: '', updatedAt: '' },
      nodes: [
        {
          id: 'f1',
          name: 'userName',
          type: 'input',
          props: { label: '姓名', required: true },
        },
      ],
      materials: [],
      dataSources: [],
      variables: [],
      rules: [],
    }
    const engine = makeEngine(schema, [inputMaterial()])
    const node = engine.current.nodes[0]

    // 模板/导入 Schema 省略的默认值，在载入时补齐（渲染器靠 modelValue 判断字段）
    expect(node.props).toMatchObject({
      modelValue: '',
      disabled: false,
      placeholder: '',
      label: '姓名',
      required: true,
    })
    expect(engine.runtime.validateAll()).toBe(false)
    expect(engine.runtime.getFieldError('f1')).toBeTruthy()

    // disabled 现在真实存在于 node.props，setNodeProp 的覆盖才能驱动组件
    engine.runtime.setNodeProp('f1', 'disabled', true)
    expect(engine.runtime.resolveProp(node, 'disabled')).toBe(true)
  })
})

describe('EditorEngine 栅格列结构', () => {
  it('appendChildrenWithProps 一次写入列宽，并保证新列名称唯一', () => {
    const engine = makeEngine(undefined, gridMaterials())
    const grid = engine.insertMaterial('grid', { parentId: null, position: 'root', index: 0 })
    const before = engine.current.nodes.filter((node) => node.type === 'grid-col')
    expect(before).toHaveLength(2)

    const created = engine.appendChildrenWithProps(grid.id, 'grid-col', [
      { span: 8 },
      { span: 8 },
    ])

    expect(created.map((node) => node.props.span)).toEqual([8, 8])
    expect(engine.current.nodes.find((node) => node.id === grid.id)!.children).toHaveLength(4)
    const names = engine.current.nodes.filter((node) => node.type === 'grid-col').map((node) => node.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
