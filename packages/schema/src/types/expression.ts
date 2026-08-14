import type { SchemaKind } from './schema'

/** 有表达式上下文的层（Plugin 层不直接承载表达式） */
export type SchemaLayer = Exclude<SchemaKind, 'Plugin'>

/**
 * 各层 Schema 可用上下文变量（P3 表达式沙箱化）
 * 表达式只能访问预定义上下文变量，禁止 eval / new Function / 语句级控制流。
 */
export const EXPRESSION_CONTEXTS: Record<SchemaLayer, readonly string[]> = {
  Page: ['$state', '$props', '$global', '$api', '$route', '$user'],
  DataModel: ['$record', '$context', '$user'],
  Process: ['$input', '$context', '$output', '$node'],
  API: ['$request', '$headers', '$auth', '$response'],
}

/** 禁止的模式：命令式语句、eval、变量声明、宿主全局对象、模板插值 */
const BANNED_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\beval\s*\(/g, message: '禁止 eval' },
  { pattern: /\bnew\s+Function\b/g, message: '禁止 new Function' },
  { pattern: /\bfunction\b/g, message: '禁止函数定义' },
  { pattern: /=>/g, message: '禁止箭头函数' },
  { pattern: /\b(let|const|var)\b/g, message: '禁止变量声明' },
  {
    pattern: /\b(if|else|for|while|do|switch|case|return)\b/g,
    message: '禁止语句级控制流',
  },
  { pattern: /;/g, message: '禁止语句分隔符' },
  { pattern: /\$\{/g, message: '禁止模板插值' },
  {
    pattern: /\b(import|export|require|globalThis|window|document|process)\b/g,
    message: '禁止访问宿主全局对象',
  },
]

const CONTEXT_VAR_PATTERN = /\$[A-Za-z_][A-Za-z0-9_]*/g

export interface ExpressionValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * 表达式沙箱校验（P3）：
 * - 拒绝命令式语句（if/else/for/while/变量声明/return）
 * - 拒绝 eval / new Function / 模板插值
 * - $ 前缀上下文变量必须在当前层可用清单内
 * - 允许：算术、比较、三元、逻辑、成员访问、纯函数调用（filter/map/find）
 * - 裸标识符视为循环局部变量或函数注册表中的纯函数
 */
export function validateExpression(
  expression: string,
  layer: SchemaLayer,
): ExpressionValidationResult {
  const errors: string[] = []
  if (typeof expression !== 'string' || expression.trim() === '') {
    return { ok: false, errors: ['表达式不能为空'] }
  }
  for (const { pattern, message } of BANNED_PATTERNS) {
    if (expression.match(pattern)) errors.push(message)
  }
  const allowed = EXPRESSION_CONTEXTS[layer]
  for (const match of expression.match(CONTEXT_VAR_PATTERN) ?? []) {
    if (!allowed.includes(match)) {
      errors.push(`未声明上下文变量: ${match}（当前层可用: ${allowed.join(', ')}）`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/** 收集 PageSpec 中所有表达式字符串（节点绑定/事件、数据源 filter、交互） */
function collectBindingExpressions(value: unknown, out: string[]): void {
  if (!value || typeof value !== 'object') return
  const v = value as Record<string, unknown>
  const visible = v.visible as { type?: unknown; value?: unknown } | undefined
  if (visible?.type === 'expression' && typeof visible.value === 'string') {
    out.push(visible.value)
  }
  const loop = v.loop as { type?: unknown; value?: unknown } | undefined
  if (loop?.type === 'expression' && loop.value && typeof loop.value === 'object') {
    const source = (loop.value as { source?: unknown }).source
    if (typeof source === 'string') out.push(source)
  }
}

function collectStyleExpressions(value: unknown, out: string[]): void {
  if (!value || typeof value !== 'object') return
  for (const binding of Object.values(value as Record<string, unknown>)) {
    if (!binding || typeof binding !== 'object') continue
    const b = binding as { type?: unknown; value?: unknown }
    if (b.type === 'expression' && typeof b.value === 'string') out.push(b.value)
  }
}

function collectActionExpressions(value: unknown, out: string[]): void {
  if (!value || typeof value !== 'object') return
  for (const actions of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      if (action && typeof action === 'object') {
        const expression = (action as { expression?: unknown }).expression
        if (typeof expression === 'string') out.push(expression)
      }
    }
  }
}

/** 校验整个 PageSpec 的所有表达式均符合 Page 层沙箱（供 zod refine 使用） */
export function validatePageSpecExpressions(spec: unknown): ExpressionValidationResult {
  const expressions: string[] = []
  if (!spec || typeof spec !== 'object') return { ok: true, errors: [] }
  const s = spec as Record<string, unknown>

  for (const node of Array.isArray(s.nodes) ? s.nodes : []) {
    if (!node || typeof node !== 'object') continue
    const n = node as Record<string, unknown>
    collectBindingExpressions(n.bindings, expressions)
    collectStyleExpressions(n.style, expressions)
    collectActionExpressions(n.events, expressions)
  }

  for (const ds of Array.isArray(s.dataSources) ? s.dataSources : []) {
    if (ds && typeof ds === 'object') {
      const filter = (ds as Record<string, unknown>).filter
      if (typeof filter === 'string') expressions.push(filter)
    }
  }

  for (const interaction of Array.isArray(s.interactions) ? s.interactions : []) {
    if (!interaction || typeof interaction !== 'object') continue
    const r = interaction as Record<string, unknown>
    if (typeof r.expression === 'string') expressions.push(r.expression)
    collectActionExpressions(r.actions, expressions)
  }

  const errors: string[] = []
  for (const expr of expressions) {
    const result = validateExpression(expr, 'Page')
    if (!result.ok) {
      for (const error of result.errors) errors.push(`[${expr}] ${error}`)
    }
  }
  return { ok: errors.length === 0, errors }
}
