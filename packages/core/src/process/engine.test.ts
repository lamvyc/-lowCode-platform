import { describe, expect, it, vi } from 'vitest'
import { JexlExpressionEngine, ProcessEngine } from '@lowcode/core'
import type { ProcessEngineOptions } from '@lowcode/core'
import { createProcessSchema, type ProcessSpec } from '@lowcode/schema'

function makeEngine(spec: ProcessSpec, options: Partial<ProcessEngineOptions> = {}): ProcessEngine {
  const schema = createProcessSchema({ id: 'p1', name: '测试流程' }, spec)
  return new ProcessEngine({
    schema,
    expression: new JexlExpressionEngine(),
    ...options,
  })
}

describe('ProcessEngine 线性流程', () => {
  it('start → apiCall → end 写入输出', async () => {
    const callApi = vi.fn().mockResolvedValue({ id: 1, name: '张三' })
    const engine = makeEngine(
      {
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'call', type: 'apiCall', apiRef: 'getUser', output: 'user' },
          { id: 'end', type: 'end' },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'call' },
          { id: 'e2', from: 'call', to: 'end' },
        ],
      },
      { callApi },
    )
    const snapshot = await engine.run()
    expect(snapshot.status).toBe('completed')
    expect(callApi).toHaveBeenCalledWith('getUser', {}, expect.anything())
    expect(engine.getOutput()).toEqual({ user: { id: 1, name: '张三' } })
  })

  it('dataModel 节点按 modelRef + operation 取数', async () => {
    const callDataModel = vi.fn().mockResolvedValue([{ id: 'o1' }])
    const engine = makeEngine(
      {
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'query', type: 'dataModel', modelRef: 'Order', operation: 'query', output: 'orders' },
          { id: 'end', type: 'end' },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'query' },
          { id: 'e2', from: 'query', to: 'end' },
        ],
      },
      { callDataModel },
    )
    await engine.run()
    expect(callDataModel).toHaveBeenCalledWith('Order', 'query', {}, expect.anything())
    expect(engine.getOutput()).toEqual({ orders: [{ id: 'o1' }] })
  })

  it('delay 节点按毫秒延时后继续', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'wait', type: 'delay', delayMs: 1 },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'wait' },
        { id: 'e2', from: 'wait', to: 'end' },
      ],
    })
    const snapshot = await engine.run()
    expect(snapshot.status).toBe('completed')
  })
})

describe('ProcessEngine 排他网关', () => {
  const spec: ProcessSpec = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'gw', type: 'condition' },
      { id: 'approve', type: 'task', name: '审批', output: 'decision' },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { id: 'e1', from: 'start', to: 'gw' },
      { id: 'e2', from: 'gw', to: 'approve', expression: '$input.amount > 100' },
      { id: 'e3', from: 'gw', to: 'end' },
    ],
  }

  it('命中表达式分支进入人工任务并等待', async () => {
    const engine = makeEngine(spec)
    const snapshot = await engine.run({ amount: 200 })
    expect(snapshot.status).toBe('waiting')
    expect(snapshot.pendingTaskId).toBe('approve')
    expect(snapshot.currentNodeIds).toEqual(['approve'])
  })

  it('未命中表达式走默认分支直达 end', async () => {
    const engine = makeEngine(spec)
    const snapshot = await engine.run({ amount: 50 })
    expect(snapshot.status).toBe('completed')
  })

  it('无默认分支且表达式全为假时报 failed', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'gw', type: 'condition' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'gw' },
        { id: 'e2', from: 'gw', to: 'end', expression: '$input.x > 10' },
      ],
    })
    const snapshot = await engine.run({ x: 1 })
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toContain('无匹配分支')
  })
})

describe('ProcessEngine 人工任务状态机', () => {
  it('completeTask 续跑并把结果写入 output', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'approve', type: 'task', name: '审批', output: 'decision' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'approve' },
        { id: 'e2', from: 'approve', to: 'end' },
      ],
    })
    await engine.run()
    expect(engine.getStatus()).toBe('waiting')

    const snapshot = await engine.completeTask('approve', 'approved')
    expect(snapshot.status).toBe('completed')
    expect(engine.getOutput()).toEqual({ decision: 'approved' })
  })

  it('非等待状态 completeTask 抛错', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'end', type: 'end' },
      ],
      edges: [{ id: 'e1', from: 'start', to: 'end' }],
    })
    await engine.run()
    await expect(engine.completeTask('approve')).rejects.toThrow('任务不可完成')
  })

  it('terminate 置为终止态', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'approve', type: 'task' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'approve' },
        { id: 'e2', from: 'approve', to: 'end' },
      ],
    })
    await engine.run()
    const snapshot = engine.terminate('取消')
    expect(snapshot.status).toBe('terminated')
    expect(snapshot.error).toBe('取消')
  })
})

describe('ProcessEngine 表达式与异常', () => {
  it('变量默认值 + $variables 入参表达式求值', async () => {
    const callApi = vi.fn().mockResolvedValue('ok')
    const engine = makeEngine(
      {
        variables: [{ name: 'greeting', type: 'string', defaultValue: 'hello' }],
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'call', type: 'apiCall', apiRef: 'echo', input: { text: '$variables.greeting' }, output: 'msg' },
          { id: 'end', type: 'end' },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'call' },
          { id: 'e2', from: 'call', to: 'end' },
        ],
      },
      { callApi },
    )
    await engine.run()
    expect(callApi).toHaveBeenCalledWith('echo', { text: 'hello' }, expect.anything())
    expect(engine.getOutput()).toEqual({ msg: 'ok' })
  })

  it('缺少 start 节点返回 failed', async () => {
    const engine = makeEngine({
      nodes: [{ id: 'end', type: 'end' }],
      edges: [],
    })
    const snapshot = await engine.run()
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toContain('start')
  })

  it('缺少 callApi 能力返回 failed', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'call', type: 'apiCall', apiRef: 'x' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'call' },
        { id: 'e2', from: 'call', to: 'end' },
      ],
    })
    const snapshot = await engine.run()
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toContain('callApi')
  })

  it('指向不存在节点的边返回 failed', async () => {
    const engine = makeEngine({
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'end', type: 'end' },
      ],
      edges: [{ id: 'e1', from: 'start', to: 'missing' }],
    })
    const snapshot = await engine.run()
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toContain('节点不存在')
  })
})
