import { Jexl } from 'jexl'

/** 表达式求值上下文：多级作用域 */
export interface ExpressionContext {
  local?: Record<string, unknown>
  loop?: Record<string, unknown>
  page?: Record<string, unknown>
  datasource?: Record<string, unknown>
  global?: Record<string, unknown>
  [key: string]: unknown
}

export type ExpressionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/** 表达式引擎接口：Runtime / Action / Rule 统一依赖它 */
export interface IExpressionEngine {
  evaluate<T = unknown>(expression: string, context?: ExpressionContext): T
  tryEvaluate<T = unknown>(expression: string, context?: ExpressionContext): ExpressionResult<T>
  compile(expression: string): (context?: ExpressionContext) => unknown
  addFunction(name: string, fn: (...args: unknown[]) => unknown): void
  addFunctions(functions: Record<string, (...args: unknown[]) => unknown>): void
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

  constructor(functions?: Record<string, (...args: unknown[]) => unknown>) {
    this.jexl = new Jexl()
    this.addFunctions(DEFAULT_FUNCTIONS)
    if (functions) this.addFunctions(functions)
  }

  addFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    this.jexl.addFunction(name, fn as (...args: never[]) => unknown)
  }

  addFunctions(functions: Record<string, (...args: unknown[]) => unknown>): void {
    for (const [name, fn] of Object.entries(functions)) {
      this.addFunction(name, fn)
    }
  }

  compile(expression: string): (context?: ExpressionContext) => unknown {
    const compiled = this.jexl.createExpression(normalizeExpression(expression))
    return (context) => compiled.evalSync(this.mergeContext(context))
  }

  evaluate<T = unknown>(expression: string, context?: ExpressionContext): T {
    return this.jexl
      .createExpression(normalizeExpression(expression))
      .evalSync(this.mergeContext(context)) as T
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
    }
    // 直接变量（如 inputValue）展开到顶层
    for (const [key, value] of Object.entries(context ?? {})) {
      if (!(key in namespaces)) {
        merged[key] = value
      }
    }
    // 命名空间作用域展开到顶层，支持 user.age 写法
    for (const scope of [namespaces.local, namespaces.loop, namespaces.page, namespaces.global]) {
      if (scope) Object.assign(merged, scope)
    }
    for (const [name, scope] of Object.entries(namespaces)) {
      merged[name] = scope ?? {}
      merged[`$${name}`] = scope ?? {}
    }
    return merged
  }
}
