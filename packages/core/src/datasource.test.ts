import { describe, expect, it, vi } from 'vitest'
import type { DataSource, HttpClient } from '@lowcode/core'
import { DataSourceManager, MemoryStorage } from '@lowcode/core'

function makeRestSource(): DataSource {
  return {
    id: 'users',
    name: '用户列表',
    type: 'rest',
    config: { url: '/api/users' },
    autoLoad: true,
  }
}

describe('DataSourceManager 数据源管理器', () => {
  it('static 数据源直接返回数据', async () => {
    const manager = new DataSourceManager({ storage: new MemoryStorage() })
    manager.register({
      id: 's1',
      name: '静态',
      type: 'static',
      config: { staticData: [{ id: 1 }] },
    })
    await manager.load('s1')
    expect(manager.getData('s1')).toEqual([{ id: 1 }])
    expect(manager.getState('s1').status).toBe('success')
  })

  it('rest 数据源通过注入的 HttpClient 请求', async () => {
    const http: HttpClient = {
      request: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    }
    const manager = new DataSourceManager({ http, storage: new MemoryStorage() })
    manager.register(makeRestSource())
    await manager.load('users')
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/users' }),
    )
    expect(manager.getData('users')).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('localStorage 数据源从存储读取并解析', async () => {
    const storage = new MemoryStorage()
    storage.setItem('key1', JSON.stringify({ a: 1 }))
    const manager = new DataSourceManager({ storage })
    manager.register({
      id: 'ls1',
      name: '本地',
      type: 'localStorage',
      config: { storageKey: 'key1' },
    })
    await manager.load('ls1')
    expect(manager.getData('ls1')).toEqual({ a: 1 })
  })

  it('请求失败时状态为 error 并保留错误信息', async () => {
    const http: HttpClient = {
      request: vi.fn().mockRejectedValue(new Error('网络错误')),
    }
    const manager = new DataSourceManager({ http, storage: new MemoryStorage() })
    manager.register(makeRestSource())
    await expect(manager.load('users')).rejects.toThrow('网络错误')
    expect(manager.getState('users').status).toBe('error')
  })

  it('setData 手动写入并触发状态更新', () => {
    const manager = new DataSourceManager({ storage: new MemoryStorage() })
    manager.register(makeRestSource())
    const onChange = vi.fn()
    manager.onStateChange(onChange)
    manager.setData('users', [3])
    expect(manager.getData('users')).toEqual([3])
    expect(onChange).toHaveBeenCalled()
  })

  it('loadAll 加载全部 autoLoad 数据源', async () => {
    const http: HttpClient = {
      request: vi.fn().mockResolvedValue('ok'),
    }
    const manager = new DataSourceManager({ http, storage: new MemoryStorage() })
    manager.register(makeRestSource())
    manager.register({ ...makeRestSource(), id: 'orders', name: '订单' })
    await manager.loadAll()
    expect(http.request).toHaveBeenCalledTimes(2)
  })

  it('rest 数据源未注入 HttpClient 时抛错', async () => {
    const manager = new DataSourceManager({ storage: new MemoryStorage() })
    manager.register(makeRestSource())
    await expect(manager.load('users')).rejects.toThrow('HttpClient')
  })

  it('pageVariable 数据源通过 getVariables 读取实时变量', async () => {
    const variables: Record<string, unknown> = { keyword: '初始值' }
    const manager = new DataSourceManager({
      storage: new MemoryStorage(),
      getVariables: () => variables,
    })
    manager.register({
      id: 'varSrc',
      name: '变量源',
      type: 'pageVariable',
      config: { variableId: 'keyword' },
    })
    expect(await manager.load('varSrc')).toBe('初始值')
    variables.keyword = '新值'
    expect(await manager.load('varSrc')).toBe('新值')
  })

  it('loadAll 单数据源失败不阻断其余数据源', async () => {
    const http: HttpClient = {
      request: vi.fn().mockRejectedValue(new Error('网络错误')),
    }
    const onLoadError = vi.fn()
    const manager = new DataSourceManager({ http, storage: new MemoryStorage(), onLoadError })
    manager.register(makeRestSource())
    manager.register({ ...makeRestSource(), id: 'orders', name: '订单' })
    manager.register({
      id: 'static1',
      name: '静态',
      type: 'static',
      config: { staticData: 'ok' },
    })
    await expect(manager.loadAll()).resolves.toBeUndefined()
    expect(onLoadError).toHaveBeenCalledTimes(2)
    expect(manager.getData('static1')).toBe('ok')
  })
})
