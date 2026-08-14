import type { DataSource } from '@lowcode/schema'
import type { SchemaRefResolver } from '../schema-registry/registry'

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
  /**
   * 页面变量快照（pageVariable 类型数据源读取）。
   * @deprecated 使用 getVariables 获取实时变量，避免读到过期快照。
   */
  variables?: Record<string, unknown>
  /** 实时读取页面变量（pageVariable 数据源优先使用，变量变更后重新 load 可得新值） */
  getVariables?: () => Record<string, unknown>
  onStateChange?: (id: string, state: DataSourceState) => void
  /** 单个数据源加载失败的回调（loadAll 失败隔离时使用） */
  onLoadError?: (id: string, error: unknown) => void
  /** DataModel/API 数据源的引用解析器（解析 modelRef/apiRef → Schema） */
  schemaResolver?: SchemaRefResolver
}

/**
 * 数据源管理器：统一 loading / data / error 状态，
 * Runtime 订阅状态变化驱动 UI 更新。
 */
export class DataSourceManager {
  /** 已注册数据源 */
  readonly sources = new Map<string, DataSource>()
  /** 数据源状态表 */
  readonly states = new Map<string, DataSourceState>()
  /** 状态变更监听器 */
  readonly listeners = new Set<(id: string, state: DataSourceState) => void>()
  /** 轮询定时器 */
  readonly timers = new Map<string, ReturnType<typeof setInterval>>()

  /** 构造选项 */
  readonly options: DataSourceManagerOptions

  constructor(options: DataSourceManagerOptions = {}) {
    this.options = options
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
        try {
          await this.load(source.id)
        } catch (error) {
          // 失败隔离：单个数据源报错不阻断其余数据源，也不向上抛异常
          this.options.onLoadError?.(source.id, error)
        }
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

  /** 按数据源类型执行实际获取逻辑 */
  async fetch(
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
        const variables = this.options.getVariables
          ? this.options.getVariables()
          : this.options.variables
        return variables?.[variableId]
      }
      case 'DataModel': {
        const model = this.options.schemaResolver?.resolveDataModel(
          source.config.modelRef ?? '',
        )
        if (!model) {
          throw new Error(`数据模型未注册: ${source.config.modelRef ?? ''}`)
        }
        const http = this.options.http
        if (!http) throw new Error('DataModel 数据源需要注入 HttpClient')
        const collection = model.spec.collection ?? model.metadata.id
        const operation = source.config.operation ?? 'query'
        const base = `/api/entities/${collection}`
        switch (operation) {
          case 'create':
            return http.request({ url: base, method: 'POST', body: params })
          case 'update':
            return http.request({
              url: `${base}/${String((params ?? {}).id ?? '')}`,
              method: 'PUT',
              body: params,
            })
          case 'delete':
            return http.request({
              url: `${base}/${String((params ?? {}).id ?? '')}`,
              method: 'DELETE',
            })
          case 'query':
          default:
            return http.request({
              url: base,
              method: 'GET',
              params: { filter: source.config.filter, ...(params ?? {}) },
            })
        }
      }
      case 'API': {
        const api = this.options.schemaResolver?.resolveApi(source.config.apiRef ?? '')
        if (!api) throw new Error(`API 未注册: ${source.config.apiRef ?? ''}`)
        const http = this.options.http
        if (!http) throw new Error('API 数据源需要注入 HttpClient')
        const spec = api.spec
        return http.request({
          url: spec.endpoint,
          method: spec.method,
          params: { ...(source.config.params ?? {}), ...(params ?? {}) },
          headers: spec.request?.headers,
        })
      }
      default:
        throw new Error(`不支持的数据源类型: ${source.type}`)
    }
  }

  /** 更新状态并通知监听器 */
  setState(id: string, state: DataSourceState): void {
    this.states.set(id, state)
    for (const listener of this.listeners) {
      listener(id, state)
    }
  }

  /** 启动轮询（配置了 pollInterval 时） */
  setupPolling(source: DataSource): void {
    const interval = source.config.pollInterval
    if (!interval || interval <= 0 || this.timers.has(source.id)) return
    const timer = setInterval(() => {
      void this.load(source.id)
    }, interval)
    this.timers.set(source.id, timer)
  }

  /** 停止轮询 */
  stopPolling(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(id)
    }
  }
}
