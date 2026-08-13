import type { DataSource } from '@lowcode/schema'

/** HTTP 请求配置 */
export interface HttpRequestConfig {
  url: string
  method?: string
  params?: Record<string, unknown>
  headers?: Record<string, string>
  body?: unknown
}

/** HTTP 客户端接口：Core 不直接依赖 fetch，由调用方注入 */
export interface HttpClient {
  request(config: HttpRequestConfig): Promise<unknown>
}

/** 存储接口：Core 不直接依赖 DOM Storage */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 内存存储：测试与 SSR 场景的默认实现 */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

/** 数据源状态 */
export interface DataSourceState {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: unknown
  error?: string
  updatedAt?: number
}

export interface DataSourceManagerOptions {
  http?: HttpClient
  storage?: StorageLike
  /** 页面变量快照（pageVariable 类型数据源读取） */
  variables?: Record<string, unknown>
  onStateChange?: (id: string, state: DataSourceState) => void
}

/**
 * 数据源管理器：统一 loading / data / error 状态，
 * Runtime 订阅状态变化驱动 UI 更新。
 */
export class DataSourceManager {
  private sources = new Map<string, DataSource>()
  private states = new Map<string, DataSourceState>()
  private listeners = new Set<(id: string, state: DataSourceState) => void>()
  private timers = new Map<string, ReturnType<typeof setInterval>>()

  constructor(private options: DataSourceManagerOptions = {}) {
    if (options.onStateChange) this.listeners.add(options.onStateChange)
  }

  register(source: DataSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`数据源已注册: ${source.id}`)
    }
    this.sources.set(source.id, source)
    this.states.set(source.id, { status: 'idle', data: undefined })
  }

  getSource(id: string): DataSource | undefined {
    return this.sources.get(id)
  }

  /** 订阅状态变化，返回取消订阅函数 */
  onStateChange(listener: (id: string, state: DataSourceState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 加载数据源（自动处理 loading/success/error 状态） */
  async load(id: string, params?: Record<string, unknown>): Promise<unknown> {
    const source = this.getSource(id)
    if (!source) throw new Error(`数据源未注册: ${id}`)
    this.setState(id, { status: 'loading', data: undefined })
    try {
      const data = await this.fetch(source, params)
      this.setState(id, { status: 'success', data, updatedAt: Date.now() })
      this.setupPolling(source)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState(id, { status: 'error', data: undefined, error: message })
      throw error
    }
  }

  /** 加载全部数据源（默认跳过 autoLoad 为 false 的） */
  async loadAll(): Promise<void> {
    for (const source of this.sources.values()) {
      if (source.autoLoad !== false) {
        await this.load(source.id)
      }
    }
  }

  /** 手动写入数据 */
  setData(id: string, data: unknown): void {
    this.setState(id, { status: 'success', data, updatedAt: Date.now() })
  }

  getData(id: string): unknown {
    return this.getState(id).data
  }

  getState(id: string): DataSourceState {
    return this.states.get(id) ?? { status: 'idle', data: undefined }
  }

  /** 所有数据源数据快照（供表达式上下文使用） */
  getAllData(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [id, state] of this.states) {
      result[id] = state.data
    }
    return result
  }

  remove(id: string): void {
    this.stopPolling(id)
    this.sources.delete(id)
    this.states.delete(id)
  }

  private async fetch(
    source: DataSource,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (source.type) {
      case 'static':
        return source.config.staticData
      case 'rest': {
        const http = this.options.http
        if (!http) throw new Error('REST 数据源需要注入 HttpClient')
        return http.request({
          url: source.config.url ?? '',
          method: source.config.method ?? 'GET',
          params: { ...(source.config.params ?? {}), ...(params ?? {}) },
          headers: source.config.headers ?? {},
        })
      }
      case 'localStorage':
      case 'sessionStorage': {
        const storage = this.options.storage
        if (!storage) throw new Error('存储类数据源需要注入 Storage')
        const raw = storage.getItem(source.config.storageKey ?? '')
        return raw ? (JSON.parse(raw) as unknown) : undefined
      }
      case 'pageVariable': {
        const variableId = source.config.variableId ?? ''
        return this.options.variables?.[variableId]
      }
      default:
        throw new Error(`不支持的数据源类型: ${source.type}`)
    }
  }

  private setState(id: string, state: DataSourceState): void {
    this.states.set(id, state)
    for (const listener of this.listeners) {
      listener(id, state)
    }
  }

  private setupPolling(source: DataSource): void {
    const interval = source.config.pollInterval
    if (!interval || interval <= 0 || this.timers.has(source.id)) return
    const timer = setInterval(() => {
      void this.load(source.id)
    }, interval)
    this.timers.set(source.id, timer)
  }

  private stopPolling(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(id)
    }
  }
}
