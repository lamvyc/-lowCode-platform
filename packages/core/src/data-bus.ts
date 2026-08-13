/**
 * 轻量事件总线：模块之间解耦通信。
 * Core 用它做 DataBus / 插件事件，不依赖任何框架。
 */
export type BusListener<T = unknown> = (payload: T) => void | Promise<void>

export class DataBus {
  private listeners = new Map<string, Set<BusListener>>()

  /** 订阅事件，返回取消订阅函数 */
  on<T>(event: string, listener: BusListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as BusListener)
    return () => this.off(event, listener as BusListener)
  }

  /** 只订阅一次 */
  once<T>(event: string, listener: BusListener<T>): () => void {
    const wrapper: BusListener<T> = (payload) => {
      this.off(event, wrapper as BusListener)
      return listener(payload)
    }
    return this.on(event, wrapper)
  }

  off<T>(event: string, listener: BusListener<T>): void {
    this.listeners.get(event)?.delete(listener as BusListener)
  }

  /** 同步派发：单个监听器抛错不影响其他监听器 */
  emit<T>(event: string, payload?: T): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of [...set]) {
      try {
        void listener(payload)
      } catch {
        // 隔离单个监听器的错误
      }
    }
  }

  /** 异步派发：等待所有监听器完成 */
  async emitAsync<T>(event: string, payload?: T): Promise<void> {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of [...set]) {
      await listener(payload)
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
