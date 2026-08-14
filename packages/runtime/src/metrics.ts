/** 单指标样本 */
export interface MetricSample {
  /** 触发次数 */
  count: number
  /** 累计耗时（毫秒） */
  totalMs: number
  /** 最近一次耗时（毫秒） */
  lastMs: number
}

/** 采样表（模块级，避免类私有成员破坏结构类型匹配） */
const sampleTables = new WeakMap<EngineMetrics, Map<string, MetricSample>>()

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * 引擎执行指标（E5 性能可观测）：
 * render / event.execute / datasource.load / rules.run 等耗时均可采样。
 */
export class EngineMetrics {
  /** 开始计时，返回结束函数（幂等） */
  start(name: string): () => void {
    const start = now()
    let ended = false
    return () => {
      if (ended) return
      ended = true
      this.record(name, now() - start)
    }
  }

  /** 记录一次耗时样本 */
  record(name: string, ms: number): void {
    const samples = sampleTables.get(this) ?? new Map<string, MetricSample>()
    const sample = samples.get(name) ?? { count: 0, totalMs: 0, lastMs: 0 }
    sample.count += 1
    sample.totalMs += ms
    sample.lastMs = ms
    samples.set(name, sample)
    sampleTables.set(this, samples)
  }

  /** 记录纯计数（不参与耗时，如渲染节点数） */
  increment(name: string, by = 1): void {
    const samples = sampleTables.get(this) ?? new Map<string, MetricSample>()
    const sample = samples.get(name) ?? { count: 0, totalMs: 0, lastMs: 0 }
    sample.count += by
    samples.set(name, sample)
    sampleTables.set(this, samples)
  }

  snapshot(): Record<string, MetricSample> {
    return Object.fromEntries(sampleTables.get(this) ?? new Map())
  }

  reset(): void {
    sampleTables.delete(this)
  }
}
