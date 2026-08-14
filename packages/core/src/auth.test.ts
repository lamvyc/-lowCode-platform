import { describe, expect, it, vi } from 'vitest'
import type { AuthProvider, HttpClient } from '@lowcode/core'
import { HttpError, authenticatedHttpClient } from '@lowcode/core'

describe('authenticatedHttpClient', () => {
  it('为请求注入 Bearer token', async () => {
    const request = vi.fn().mockResolvedValue('data')
    const base: HttpClient = { request }
    const auth: AuthProvider = { getToken: () => 't1', refresh: async () => 't2' }
    const client = authenticatedHttpClient(base, { auth })

    await expect(client.request({ url: '/x' })).resolves.toBe('data')
    expect(request).toHaveBeenCalledWith({ url: '/x', headers: { Authorization: 'Bearer t1' } })
  })

  it('无 token 时不注入认证头', async () => {
    const request = vi.fn().mockResolvedValue('data')
    const auth: AuthProvider = { getToken: () => null, refresh: async () => 't2' }
    const client = authenticatedHttpClient({ request }, { auth })

    await client.request({ url: '/x' })
    expect(request).toHaveBeenCalledWith({ url: '/x', headers: {} })
  })

  it('401 时刷新令牌并重试一次', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('unauthorized', 401))
      .mockResolvedValueOnce('data')
    const auth: AuthProvider = {
      getToken: () => 't1',
      refresh: async () => 't2',
    }
    const onUnauthorized = vi.fn()
    const client = authenticatedHttpClient({ request }, { auth, onUnauthorized })

    await expect(client.request({ url: '/x' })).resolves.toBe('data')
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenNthCalledWith(2, { url: '/x', headers: { Authorization: 'Bearer t2' } })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('刷新失败触发 onUnauthorized 并向上抛', async () => {
    const request = vi.fn().mockRejectedValue(new HttpError('unauthorized', 401))
    const auth: AuthProvider = {
      getToken: () => 't1',
      refresh: async () => {
        throw new Error('刷新失败')
      },
    }
    const onUnauthorized = vi.fn()
    const client = authenticatedHttpClient({ request }, { auth, onUnauthorized })

    await expect(client.request({ url: '/x' })).rejects.toThrow('刷新失败')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('非 401 错误直接抛出且不刷新', async () => {
    const request = vi.fn().mockRejectedValue(new Error('网络错误'))
    const refresh = vi.fn().mockResolvedValue('t2')
    const auth: AuthProvider = { getToken: () => 't1', refresh }
    const client = authenticatedHttpClient({ request }, { auth })

    await expect(client.request({ url: '/x' })).rejects.toThrow('网络错误')
    expect(refresh).not.toHaveBeenCalled()
  })
})
