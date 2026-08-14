import { describe, expect, it, vi } from 'vitest'
import type { ConnectorDefinition, HttpClient } from '@lowcode/core'
import {
  ActionRegistry,
  ConnectorRegistry,
  JexlExpressionEngine,
  UnifiedActionRunner,
  registerConnectorActions,
} from '@lowcode/core'
import type { ActionContext } from '@lowcode/core'

const wecom: ConnectorDefinition = {
  name: 'wecom',
  label: '企业微信',
  baseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
  auth: { type: 'bearer' },
  actions: [
    { name: 'sendMessage', label: '发送企业微信消息', method: 'POST', path: '/message/send' },
    { name: 'getUser', label: '读取成员', method: 'GET', path: '/user/get' },
  ],
}

function makeHttp(result: unknown = { ok: true }): HttpClient {
  return { request: vi.fn().mockResolvedValue(result) }
}

function createContext(): ActionContext {
  return {
    expression: new JexlExpressionEngine(),
    getState: () => ({}),
    setState: () => {},
  }
}

describe('ConnectorRegistry', () => {
  it('注册 / 查询 / 重复注册抛错', () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    expect(registry.has('wecom')).toBe(true)
    expect(registry.get('wecom')?.label).toBe('企业微信')
    expect(() => registry.register(wecom)).toThrow('连接器已注册')
  })

  it('POST 动作组装 body + bearer 认证头', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    const http = makeHttp()
    await registry.invoke('wecom', 'sendMessage', { touser: 'a', content: 'hi' }, {
      http,
      getCredential: () => 'token123',
    })
    expect(http.request).toHaveBeenCalledWith({
      url: 'https://qyapi.weixin.qq.com/cgi-bin/message/send',
      method: 'POST',
      headers: { Authorization: 'Bearer token123' },
      body: { touser: 'a', content: 'hi' },
    })
  })

  it('GET 动作组装 query 参数', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    const http = makeHttp()
    await registry.invoke('wecom', 'getUser', { userid: 'u1' }, { http })
    expect(http.request).toHaveBeenCalledWith({
      url: 'https://qyapi.weixin.qq.com/cgi-bin/user/get',
      method: 'GET',
      headers: {},
      params: { userid: 'u1' },
    })
  })

  it('apiKey 认证注入 X-Api-Key 头', async () => {
    const registry = new ConnectorRegistry()
    registry.register({
      name: 'sap',
      baseUrl: 'https://sap.example',
      auth: { type: 'apiKey' },
      actions: [{ name: 'list', method: 'GET', path: '/orders' }],
    })
    const http = makeHttp()
    await registry.invoke('sap', 'list', {}, { http, getCredential: () => 'k-123' })
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Api-Key': 'k-123' } }),
    )
  })

  it('无凭证时不注入认证头', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    const http = makeHttp()
    await registry.invoke('wecom', 'getUser', {}, { http })
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ headers: {} }))
  })

  it('未注册连接器 / 动作抛错', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    await expect(registry.invoke('missing', 'x', {}, { http: makeHttp() })).rejects.toThrow('连接器未注册')
    await expect(registry.invoke('wecom', 'missing', {}, { http: makeHttp() })).rejects.toThrow('连接器动作不存在')
  })
})

describe('registerConnectorActions', () => {
  it('把连接器动作注册为自定义动作并可通过 UnifiedActionRunner 调用', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    const actionRegistry = new ActionRegistry()
    const http = makeHttp({ errcode: 0 })
    registerConnectorActions({
      registry,
      actionRegistry,
      http,
      getCredential: () => 'token',
    })

    expect(actionRegistry.has('wecom.sendMessage')).toBe(true)

    const results = await new UnifiedActionRunner(actionRegistry).run(
      [{ id: 'a1', type: 'wecom.sendMessage', params: { touser: 'a' } }],
      createContext(),
    )
    expect(results[0]?.ok).toBe(true)
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://qyapi.weixin.qq.com/cgi-bin/message/send' }),
    )
  })

  it('连接器调用失败时动作返回错误结果', async () => {
    const registry = new ConnectorRegistry()
    registry.register(wecom)
    const actionRegistry = new ActionRegistry()
    registerConnectorActions({
      registry,
      actionRegistry,
      http: { request: vi.fn().mockRejectedValue(new Error('网络错误')) },
    })

    const results = await new UnifiedActionRunner(actionRegistry).run(
      [{ id: 'a1', type: 'wecom.sendMessage', params: {} }],
      createContext(),
    )
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.error).toContain('网络错误')
  })
})
