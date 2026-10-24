/** 模板/脚本两种表达式重写模式 */
export type ExpressionMode = 'template' | 'script'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 数据源 id → 生成脚本里的 ref 名（与 generator 的 ref 初始化必须同一规则）。
 * 例：`user-list` → `userList`。
 */
export function datasourceRefName(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_$]/g, '_')
  return (
    cleaned.charAt(0).toLowerCase() +
    cleaned
      .slice(1)
      .replace(/[-_]([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase())
  )
}

/**
 * 按 token 边界替换：`$datasource.<id>` 的 id 必须以非标识符字符结尾，
 * 防止 id 为前缀（users / users2）时互相污染。
 *
 * 若 token 后面紧跟 `.`，模板模式补 `?.`、脚本模式补 `.value?.`，
 * 避免数据源尚未加载时对 null 取属性。
 */
function replaceToken(
  result: string,
  prefix: string,
  token: string,
  base: string,
  optionalOnMember: boolean,
): string {
  const pattern = new RegExp(`${prefix}${escapeRegExp(token)}(?![\\w$])(\\.)?`, 'g')
  return result.replace(pattern, (_match, dot: string | undefined) =>
    dot ? `${base}${optionalOnMember ? '?.' : '.'}` : base,
  )
}

/**
 * 表达式重写：保持 runtime 语义 —— `$datasource.x` 就是 payload，`.data` 原样保留。
 *
 * - 模板模式：`$datasource.x` → `x`（Vue 模板自动解包 ref）
 * - 脚本模式：`$datasource.x` → `x.value`
 * - `$page.v` 同理（模板 `v` / 脚本 `v.value`）
 */
export function rewriteExpression(
  expr: string,
  datasourceIds: string[],
  variableNames: string[],
  mode: ExpressionMode = 'template',
): string {
  let result = expr
  const script = mode === 'script'

  for (const id of [...datasourceIds].sort((a, b) => b.length - a.length)) {
    const ref = datasourceRefName(id)
    result = replaceToken(
      result,
      '\\$datasource\\.',
      id,
      script ? `${ref}.value` : ref,
      true,
    )
  }

  for (const name of [...variableNames].sort((a, b) => b.length - a.length)) {
    result = replaceToken(result, '\\$page\\.', name, script ? `${name}.value` : name, false)
  }

  return result
}

/** 生成物里与 core 对齐的辅助函数名 */
export const EXPRESSION_HELPER_NAMES = [
  'count',
  'isEmpty',
  'contains',
  'toUpper',
  'toLower',
  'round',
  'floor',
  'ceil',
  'join',
] as const

/**
 * 辅助函数源码：模板表达式与脚本表达式共用。
 * 语义对齐 @lowcode/core 的 DEFAULT_FUNCTIONS，不引入任何运行时依赖。
 */
export function buildExpressionHelpers(): string {
  return `function count(value) {
  if (Array.isArray(value) || typeof value === 'string') return value.length
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

function isEmpty(value) {
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0
  if (value && typeof value === 'object') return Object.keys(value).length === 0
  return value === undefined || value === null
}

function contains(haystack, needle) {
  if (Array.isArray(haystack)) return haystack.includes(needle)
  if (typeof haystack === 'string') return haystack.includes(String(needle))
  return false
}

function toUpper(value) {
  return String(value).toUpperCase()
}

function toLower(value) {
  return String(value).toLowerCase()
}

function round(value) {
  return Math.round(Number(value))
}

function floor(value) {
  return Math.floor(Number(value))
}

function ceil(value) {
  return Math.ceil(Number(value))
}

function join(value, sep) {
  return Array.isArray(value) ? value.join(String(sep ?? ',')) : String(value)
}`
}
