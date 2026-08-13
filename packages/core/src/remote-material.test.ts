import { describe, expect, it, vi } from 'vitest'
import type { RemoteMaterialManifest } from '@lowcode/schema'
import { MaterialRegistry, RemoteMaterialLoader, MemoryStorage } from '@lowcode/core'

function makeManifest(overrides: Partial<RemoteMaterialManifest> = {}): RemoteMaterialManifest {
  return {
    type: 'remote-widget',
    name: '远程组件',
    category: '远程',
    version: '1.0.0',
    url: 'https://example.com/remote-widget.js',
    format: 'esm',
    defaultProps: { text: '默认' },
    propConfigs: [{ name: 'text', label: '文案', control: 'input' }],
    ...overrides,
  }
}

describe('RemoteMaterialLoader 远程物料加载器', () => {
  it('ESM 模块 default 导出注册为物料组件', async () => {
    const component = { __marker: 'component' }
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm: vi.fn().mockResolvedValue({ default: component }),
    })
    const result = await loader.load(makeManifest())
    expect(result.ok).toBe(true)
    expect(registry.get('remote-widget')?.component).toBe(component)
    expect(registry.get('remote-widget')?.defaultProps.text).toBe('默认')
  })

  it('ESM 模块具名导出 component 也能识别', async () => {
    const component = { __marker: 'named' }
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm: vi.fn().mockResolvedValue({ component }),
    })
    await loader.load(makeManifest())
    expect(registry.get('remote-widget')?.component).toBe(component)
  })

  it('加载失败按重试次数重试', async () => {
    const loadEsm = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValue({ default: { __marker: true } })
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm,
      retries: 2,
      retryDelayMs: 0,
    })
    const result = await loader.load(makeManifest())
    expect(loadEsm).toHaveBeenCalledTimes(3)
    expect(result.ok).toBe(true)
  })

  it('重试耗尽后返回错误', async () => {
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm: vi.fn().mockRejectedValue(new Error('网络错误')),
      retries: 1,
      retryDelayMs: 0,
    })
    const result = await loader.load(makeManifest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('网络错误')
    expect(registry.has('remote-widget')).toBe(false)
  })

  it('fallback 组件在加载失败时注册', async () => {
    const fallback = { __marker: 'fallback' }
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm: vi.fn().mockRejectedValue(new Error('网络错误')),
      fallback: () => fallback,
      retries: 0,
    })
    const result = await loader.load(makeManifest())
    expect(result.ok).toBe(false)
    expect(registry.get('remote-widget')?.component).toBe(fallback)
  })

  it('同类型同版本重复加载命中缓存不再请求', async () => {
    const loadEsm = vi.fn().mockResolvedValue({ default: { __marker: true } })
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm,
    })
    await loader.load(makeManifest())
    await loader.load(makeManifest())
    expect(loadEsm).toHaveBeenCalledTimes(1)
  })

  it('加载成功后再次加载不同版本会重新请求', async () => {
    const loadEsm = vi.fn().mockResolvedValue({ default: { __marker: true } })
    const registry = new MaterialRegistry()
    const loader = new RemoteMaterialLoader({
      registry,
      storage: new MemoryStorage(),
      loadEsm,
    })
    await loader.load(makeManifest())
    await loader.load(makeManifest({ version: '2.0.0' }))
    expect(loadEsm).toHaveBeenCalledTimes(2)
  })
})
