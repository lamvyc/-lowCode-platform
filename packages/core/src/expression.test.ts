import { describe, expect, it } from 'vitest'
import { JexlExpressionEngine, FunctionRegistryImpl } from '@lowcode/core'

describe('JexlExpressionEngine 表达式引擎', () => {
  it('支持基础算术表达式', () => {
    const engine = new JexlExpressionEngine()
    expect(engine.evaluate<number>('1 + 2 * 3')).toBe(7)
  })

  it('支持上下文属性访问', () => {
    const engine = new JexlExpressionEngine()
    const result = engine.evaluate<boolean>('user.age >= 18', {
      local: { user: { age: 20 } },
    })
    expect(result).toBe(true)
  })

  it('支持 $datasource 命名空间', () => {
    const engine = new JexlExpressionEngine()
    const data = engine.evaluate<unknown[]>('$datasource.userList.data', {
      datasource: { userList: { data: [1, 2, 3] } },
    })
    expect(data).toEqual([1, 2, 3])
    const length = engine.evaluate<number>('count($datasource.userList.data)', {
      datasource: { userList: { data: [1, 2, 3] } },
    })
    expect(length).toBe(3)
  })

  it('支持 $form / $record 命名空间', () => {
    const engine = new JexlExpressionEngine()
    const result = engine.evaluate<boolean>('$form.amount > 10 && $record.status == "A"', {
      form: { amount: 20 },
      record: { status: 'A' },
    })
    expect(result).toBe(true)
    expect(engine.evaluate<number>('$form.amount', { form: { amount: 7 } })).toBe(7)
  })

  it('内置 count / contains 函数可用', () => {
    const engine = new JexlExpressionEngine()
    expect(engine.evaluate<boolean>('contains(["a", "b"], "a")')).toBe(true)
    expect(engine.evaluate<boolean>('isEmpty([])')).toBe(true)
  })

  it('支持注册自定义函数', () => {
    const engine = new JexlExpressionEngine()
    engine.addFunction('toUpper', (s: unknown) => String(s).toUpperCase())
    expect(engine.evaluate<string>('toUpper("hello")')).toBe('HELLO')
  })

  it('FunctionRegistry 注册与查询函数', () => {
    const registry = new FunctionRegistryImpl()
    registry.register('plusOne', (n: unknown) => Number(n) + 1)
    expect(registry.get('plusOne')?.(1)).toBe(2)
    expect(registry.list()).toContain('plusOne')
  })

  it('tryEvaluate 对非法表达式返回错误而不是抛异常', () => {
    const engine = new JexlExpressionEngine()
    const result = engine.tryEvaluate('???', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0)
  })

  it('不执行任意 JavaScript（eval 不可用）', () => {
    const engine = new JexlExpressionEngine()
    const result = engine.tryEvaluate('eval("1+1")', {})
    expect(result.ok).toBe(false)
  })

  it('循环变量优先级高于页面变量（loop > local > page > global）', () => {
    const engine = new JexlExpressionEngine()
    const result = engine.evaluate('item + ":" + prefix', {
      local: { item: 'LOOP_ITEM' },
      page: { item: 'PAGE_ITEM', prefix: 'PAGE' },
      global: { prefix: 'GLOBAL' },
    })
    // item 取 loop/local，prefix 取 page（页面变量遮蔽全局变量）
    expect(result).toBe('LOOP_ITEM:PAGE')
  })

  it('重复表达式只编译一次，后续命中缓存', () => {
    const engine = new JexlExpressionEngine()
    for (let i = 0; i < 100; i += 1) {
      engine.evaluate('$page.a + 1', { page: { a: 1 } })
    }
    expect(engine.stats.compileCount).toBe(1)
    expect(engine.stats.cacheHitCount).toBe(99)
    expect(engine.stats.evalCount).toBe(100)
  })

  it('注册新函数后编译缓存失效', () => {
    const engine = new JexlExpressionEngine()
    engine.evaluate('1 + 1', {})
    engine.addFunction('fn', (n: unknown) => Number(n) + 1)
    engine.evaluate('fn(1)', {})
    expect(engine.stats.compileCount).toBe(2)
  })
})
