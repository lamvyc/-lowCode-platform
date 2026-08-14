/// <reference path="../types/jexl.d.ts" />

import { Jexl } from 'jexl'

/** 表达式求值上下文：多级作用域 */
export interface ExpressionContext {
  local?: Record<string, unknown>
  loop?: Record<string, unknown>
  page?: Record<string, unknown>
  datasource?: Record<string, unknown>
  global?: Record<string, unknown>
  /** 表单值作用域（$form / form） */
  form?: Record<string, unknown>
  /** 正在编辑的记录（$record / record，DataModel 自定义校验兼容） */
  record?: Record<string, unknown>
  [key: string]: unknown
}

export type ExpressionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/** 表达式引擎运行统计（性能可观测，E5） */
export interface ExpressionEngineStats {
  /** 累计求值次数 */
  evalCount: number
  /** 累计编译次数（缓存未命中） */
  compileCount: number
  /** 缓存命中次数 */
  cacheHitCount: number
  /** 累计求值耗时（毫秒，含编译） */
  evalMs: number
}

/** 表达式引擎接口：Runtime / Action / Rule 统一依赖它 */
export interface IExpressionEngine {
  evaluate<T = unknown>(expression: string, context?: ExpressionContext): T
  tryEvaluate<T = unknown>(expression: string, context?: ExpressionContext): ExpressionResult<T>
  compile(expression: string): (context?: ExpressionContext) => unknown
  addFunction(name: string, fn: (...args: unknown[]) => unknown): void
  addFunctions(functions: Record<string, (...args: unknown[]) => unknown>): void
  /** 可选：表达式引擎运行统计（未实现时为空对象） */
  stats?: ExpressionEngineStats
}

/** 函数注册表：统一管理可在表达式中使用的函数 */
export interface FunctionRegistry {
  register(name: string, fn: (...args: unknown[]) => unknown): void
  get(name: string): ((...args: unknown[]) => unknown) | undefined
  list(): string[]
}

export class FunctionRegistryImpl implements FunctionRegistry {
  private functions = new Map<string, (...args: unknown[]) => unknown>()

  register(name: string, fn: (...args: unknown[]) => unknown): void {
    this.functions.set(name, fn)
  }

  get(name: string): ((...args: unknown[]) => unknown) | undefined {
    return this.functions.get(name)
  }

  list(): string[] {
    return [...this.functions.keys()]
  }
}

/**
 * 表达式规范化：把用户习惯的 `===` / `!==` 转为 Jexl 支持的 `==` / `!=`。
 * 带引号状态机，避免误改字符串字面量内容。
 */
export function normalizeExpression(expression: string): string {
  let quote: '"' | "'" | null = null
  let escaped = false
  const chars = expression.split('')
  const output: string[] = []
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    if (quote) {
      output.push(char)
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      output.push(char)
      continue
    }
    const rest = chars.slice(i, i + 3).join('')
    if (rest === '===') {
      output.push('==')
      i += 2
      continue
    }
    if (rest === '!==') {
      output.push('!=')
      i += 2
      continue
    }
    output.push(char)
  }
  return output.join('')
}

/** 内置安全函数：弥补 Jexl 不支持数组 .length 等原生能力的缺口 */
const DEFAULT_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  count: (value: unknown) => {
    if (Array.isArray(value) || typeof value === 'string') return value.length
    if (typeof value === 'object' && value !== null) return Object.keys(value).length
    return 0
  },
  isEmpty: (value: unknown) => {
    if (Array.isArray(value) || typeof value === 'string') return value.length === 0
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0
    return value === undefined || value === null
  },
  contains: (haystack: unknown, needle: unknown) => {
    if (Array.isArray(haystack)) return haystack.includes(needle)
    if (typeof haystack === 'string') return haystack.includes(String(needle))
    return false
  },
  toUpper: (value: unknown) => String(value).toUpperCase(),
  toLower: (value: unknown) => String(value).toLowerCase(),
  round: (value: unknown) => Math.round(Number(value)),
  floor: (value: unknown) => Math.floor(Number(value)),
  ceil: (value: unknown) => Math.ceil(Number(value)),
  join: (value: unknown, sep: unknown) =>
    Array.isArray(value) ? value.join(String(sep ?? ',')) : String(value),
}

/**
 * 基于 Jexl 的表达式引擎。
 * Jexl 是安全的表达式 DSL：不执行任意 JavaScript，天然满足
 * 「禁止 eval / new Function」的要求。
 */
export class JexlExpressionEngine implements IExpressionEngine {
  private jexl: Jexl
  /** 编译结果缓存：同一表达式只编译一次（E5 AST 缓存） */
  private cache = new Map<string, ReturnType<Jexl['createExpression']>>()
  readonly stats: ExpressionEngineStats = { evalCount: 0, compileCount: 0, cacheHitCount: 0, evalMs: 0 }
  private readonly now: () => number

  constructor(
    functions?: Record<string, (...args: unknown[]) => unknown>,
    /** 是否采集耗时统计；计数统计始终开启 */
    private collectStats = true,
  ) {
    this.jexl = new Jexl()
    this.addFunctions(DEFAULT_FUNCTIONS)
    if (functions) this.addFunctions(functions)
    this.now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()
  }

  addFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    this.jexl.addFunction(name, fn as (...args: never[]) => unknown)
    // 新增函数可能改变已有表达式的解析结果，缓存必须失效
    this.cache.clear()
  }

  addFunctions(functions: Record<string, (...args: unknown[]) => unknown>): void {
    for (const [name, fn] of Object.entries(functions)) {
      this.addFunction(name, fn)
    }
  }

  compile(expression: string): (context?: ExpressionContext) => unknown {
    const compiled = this.getCompiled(expression)
    return (context) => compiled.evalSync(this.mergeContext(context))
  }

  evaluate<T = unknown>(expression: string, context?: ExpressionContext): T {
    this.stats.evalCount += 1
    const start = this.collectStats ? this.now() : 0
    try {
      return this.getCompiled(expression).evalSync(this.mergeContext(context)) as T
    } finally {
      if (this.collectStats) {
        this.stats.evalMs += this.now() - start
      }
    }
  }

  tryEvaluate<T = unknown>(expression: string, context?: ExpressionContext): ExpressionResult<T> {
    try {
      return { ok: true, value: this.evaluate<T>(expression, context) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 合并作用域：
   * - 顶层直接展开 local/loop/page/global，支持 `user.age` 写法
   * - 同时保留 $datasource / $page 等命名空间，支持 `$datasource.userList.data`
   */
  private mergeContext(context?: ExpressionContext): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    const namespaces = {
      local: context?.local,
      loop: context?.loop,
      page: context?.page,
      datasource: context?.datasource,
      global: context?.global,
      state: context?.state,
      api: context?.api,
      form: context?.form,
      record: context?.record,
    }
    // 直接变量（如 inputValue）展开到顶层
    for (const [key, value] of Object.entries(context ?? {})) {
      if (!(key in namespaces)) {
        merged[key] = value
      }
    }
    // 命名空间作用域展开到顶层，支持 user.age 写法。
    // 优先级：loop > local > page > global（后合并者覆盖先合并者）。
    // 修复：此前 page/global 覆盖 loop/local，导致页面变量遮蔽循环变量。
    for (const scope of [namespaces.global, namespaces.page, namespaces.local, namespaces.loop]) {
      if (scope) Object.assign(merged, scope)
    }
    for (const [name, scope] of Object.entries(namespaces)) {
      merged[name] = scope ?? {}
      merged[`$${name}`] = scope ?? {}
    }
    return merged
  }

  /** 编译缓存：命中直接复用，未命中编译一次（Jexl 表达式可重复求值） */
  private getCompiled(expression: string): ReturnType<Jexl['createExpression']> {
    const normalized = normalizeExpression(expression)
    let compiled = this.cache.get(normalized)
    if (!compiled) {
      compiled = this.jexl.createExpression(normalized)
      this.cache.set(normalized, compiled)
      if (this.collectStats) this.stats.compileCount += 1
    } else if (this.collectStats) {
      this.stats.cacheHitCount += 1
    }
    return compiled
  }
}
