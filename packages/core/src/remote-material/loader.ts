import type { Material, RemoteMaterialManifest } from '@lowcode/schema'
import type { MaterialRegistry } from '../material/registry'
import { MemoryStorage, type StorageLike } from '../datasource/manager'

export type RemoteLoadResult =
  | { ok: true; material: Material }
  | { ok: false; error: string }

export interface RemoteMaterialLoaderOptions {
  registry: MaterialRegistry
  /** 模块缓存存储（记录已加载清单；组件代码本身不可序列化） */
  storage?: StorageLike
  /** ESM 加载器：浏览器适配器通常是 import(url) */
  loadEsm?: (url: string) => Promise<Record<string, unknown>>
  /** UMD 加载器：浏览器适配器通常用 <script> 注入后读取全局对象 */
  loadUmd?: (url: string, globalName?: string) => Promise<Record<string, unknown>>
  /** 失败重试次数 */
  retries?: number
  retryDelayMs?: number
  /** 加载失败时的兜底组件工厂 */
  fallback?: (manifest: RemoteMaterialManifest) => unknown
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 远程物料加载器：
 * Manifest → 加载（ESM/UMD）→ 提取组件 → 注册进 MaterialRegistry。
 * 支持版本缓存、重试、fallback；Core 不直接依赖 import()/DOM，
 * 由调用方注入 loadEsm / loadUmd 适配器。
 */
export class RemoteMaterialLoader {
  private cache = new Map<string, { version: string; at: number }>()
  private options: Required<
    Pick<RemoteMaterialLoaderOptions, 'registry' | 'storage' | 'retries' | 'retryDelayMs'>
  > &
    RemoteMaterialLoaderOptions

  constructor(options: RemoteMaterialLoaderOptions) {
    this.options = {
      registry: options.registry,
      storage: options.storage ?? new MemoryStorage(),
      retries: options.retries ?? 1,
      retryDelayMs: options.retryDelayMs ?? 300,
      loadEsm: options.loadEsm,
      loadUmd: options.loadUmd,
      fallback: options.fallback,
    }
  }

  /** 加载并注册远程物料 */
  async load(manifest: RemoteMaterialManifest): Promise<RemoteLoadResult> {
    const key = this.cacheKey(manifest)
    if (this.cache.has(key)) {
      const existing = this.options.registry.get(manifest.type)
      if (existing) return { ok: true, material: existing }
    }

    try {
      const module = await this.fetchWithRetry(manifest)
      const component = this.extractComponent(module)
      if (!component) {
        throw new Error(`远程物料 ${manifest.url} 未导出组件`)
      }
      const material: Material = {
        type: manifest.type,
        name: manifest.name,
        category: manifest.category,
        icon: manifest.icon,
        description: manifest.description,
        version: manifest.version,
        defaultProps: manifest.defaultProps,
        propConfigs: manifest.propConfigs,
        slots: manifest.slots,
        droppable: manifest.droppable,
        groupable: manifest.groupable,
        component,
        remote: {
          url: manifest.url,
          format: manifest.format,
          version: manifest.version,
          dependencies: manifest.dependencies,
          cache: manifest.cache,
        },
      }
      this.options.registry.register(material)
      this.cache.set(key, { version: manifest.version, at: Date.now() })
      this.persist(manifest)
      return { ok: true, material }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (this.options.fallback) {
        this.options.registry.register({
          type: manifest.type,
          name: `${manifest.name}（加载失败）`,
          category: manifest.category,
          version: manifest.version,
          defaultProps: manifest.defaultProps,
          propConfigs: manifest.propConfigs,
          component: this.options.fallback(manifest),
          remote: {
            url: manifest.url,
            format: manifest.format,
            version: manifest.version,
          },
        })
      }
      return { ok: false, error: message }
    }
  }

  /** 已加载记录（会话缓存键 → 版本） */
  loadedVersions(): Array<{ type: string; version: string; at: number }> {
    return [...this.cache.entries()].map(([key, info]) => {
      const [type, version] = key.split('@')
      return { type, version, at: info.at }
    })
  }

  private cacheKey(manifest: RemoteMaterialManifest): string {
    return `${manifest.type}@${manifest.version}`
  }

  private async fetchWithRetry(manifest: RemoteMaterialManifest): Promise<Record<string, unknown>> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      try {
        if (manifest.format === 'umd') {
          if (!this.options.loadUmd) {
            throw new Error('UMD 远程物料需要注入 loadUmd 适配器')
          }
          return await this.options.loadUmd(manifest.url, manifest.umdGlobalName)
        }
        if (!this.options.loadEsm) {
          throw new Error('ESM 远程物料需要注入 loadEsm 适配器')
        }
        return await this.options.loadEsm(manifest.url)
      } catch (error) {
        lastError = error
        if (attempt < this.options.retries) {
          await sleep(this.options.retryDelayMs)
        }
      }
    }
    throw lastError
  }

  /** 从模块命名空间提取组件：default 优先，其次具名 component */
  private extractComponent(module: Record<string, unknown>): unknown {
    return module.default ?? module.component
  }

  private persist(manifest: RemoteMaterialManifest): void {
    this.options.storage.setItem(
      `lc.remote.${manifest.type}`,
      JSON.stringify({
        type: manifest.type,
        version: manifest.version,
        at: Date.now(),
      }),
    )
  }
}
