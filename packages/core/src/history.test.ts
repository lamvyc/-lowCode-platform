import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { cloneSchema, SCHEMA_VERSION } from '@lowcode/schema'
import { HistoryManager } from '@lowcode/core'

function makeSchema(): PageSchema {
  return cloneSchema({
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [{ id: 'n1', type: 'button', props: { text: '初始' } }],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  })
}

describe('HistoryManager 撤销重做', () => {
  it('record 修改 schema，undo 恢复，redo 重做', () => {
    const history = new HistoryManager(makeSchema())
    history.record((draft) => {
      draft.nodes[0].props = { text: '修改后' }
    })
    expect(history.current.nodes[0].props.text).toBe('修改后')

    history.undo()
    expect(history.current.nodes[0].props.text).toBe('初始')
    expect(history.canRedo).toBe(true)

    history.redo()
    expect(history.current.nodes[0].props.text).toBe('修改后')
  })

  it('批量修改只产生一个撤销步骤', () => {
    const history = new HistoryManager(makeSchema())
    history.record((draft) => {
      draft.nodes[0].props = { text: 'X' }
      draft.meta.name = '改名'
    })
    history.undo()
    expect(history.current.nodes[0].props.text).toBe('初始')
    expect(history.current.meta.name).toBe('测试')
  })

  it('相同 mergeKey 在时间窗口内合并', () => {
    const history = new HistoryManager(makeSchema())
    history.record((draft) => {
      draft.nodes[0].props = { text: 'A' }
    }, 'props', 'text')
    history.record((draft) => {
      draft.nodes[0].props = { text: 'AB' }
    }, 'props', 'text')

    expect(history.current.nodes[0].props.text).toBe('AB')
    history.undo()
    expect(history.current.nodes[0].props.text).toBe('初始')
    expect(history.canUndo).toBe(false)
    history.redo()
    expect(history.current.nodes[0].props.text).toBe('AB')
  })

  it('maxDepth 限制历史深度', () => {
    const history = new HistoryManager(makeSchema(), { maxDepth: 2 })
    history.record((d) => {
      d.meta.name = '1'
    })
    history.record((d) => {
      d.meta.name = '2'
    })
    history.record((d) => {
      d.meta.name = '3'
    })
    history.undo()
    history.undo()
    expect(history.canUndo).toBe(false)
    expect(history.current.meta.name).toBe('1')
  })

  it('record 不产生变化时不入栈', () => {
    const history = new HistoryManager(makeSchema())
    history.record(() => {
      // 无任何修改
    })
    expect(history.canUndo).toBe(false)
  })
})
