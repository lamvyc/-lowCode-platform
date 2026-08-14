import { STANDARD_ACTION_TYPES } from '@lowcode/schema'
import type { ActionRegistry } from './registry'

/**
 * 计算两个字符串的 Levenshtein 编辑距离（大小写敏感）。
 * 纯函数，用于动作类型拼写建议。
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = new Array<number>(n + 1)
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

export interface SuggestOptions {
  /** 最大编辑距离（超过视为不相关），默认 2 */
  maxDistance?: number
}

/**
 * 从候选集中找与输入最接近的动作类型建议。
 * - 大小写不敏感比较（`setstate` → `setState`）；
 * - 精确一致（大小写敏感）返回 undefined（非拼写错误）；
 * - 编辑距离超过阈值返回 undefined。
 */
export function suggestActionType(
  input: string,
  candidates: readonly string[],
  options: SuggestOptions = {},
): string | undefined {
  const maxDistance = options.maxDistance ?? 2
  const raw = input.trim()
  if (!raw) return undefined
  const target = raw.toLowerCase()

  let best: string | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    if (candidate === raw) return undefined
    const distance = levenshteinDistance(target, candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  if (best === undefined || bestDistance > maxDistance) return undefined
  return best
}

/** 收集建议候选集：标准动作 + 已注册动作（含别名），去重 */
export function collectActionCandidates(registry: ActionRegistry): string[] {
  const set = new Set<string>(STANDARD_ACTION_TYPES)
  for (const action of registry.list()) {
    set.add(action.kind)
    for (const alias of action.aliases ?? []) set.add(alias)
  }
  return [...set]
}

/** 生成「是否想写 xxx？」建议片段；无建议返回空字符串 */
export function formatActionSuggestion(input: string, registry: ActionRegistry): string {
  const suggestion = suggestActionType(input, collectActionCandidates(registry))
  return suggestion ? `，是否想写 ${suggestion}？` : ''
}
