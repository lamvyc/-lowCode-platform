import { describe, expect, it } from 'vitest'
import {
  ActionRegistry,
  collectActionCandidates,
  createBuiltinActions,
  formatActionSuggestion,
  levenshteinDistance,
  suggestActionType,
} from '@lowcode/core'

describe('levenshteinDistance', () => {
  it('相同字符串距离为 0', () => {
    expect(levenshteinDistance('setState', 'setState')).toBe(0)
  })

  it('经典用例 kitten → sitting = 3', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
  })

  it('空串距离等于另一侧长度', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3)
    expect(levenshteinDistance('abc', '')).toBe(3)
  })
})

describe('suggestActionType', () => {
  const candidates = ['setState', 'navigate', 'myPluginAction']

  it('大小写拼错建议规范写法（setstate → setState）', () => {
    expect(suggestActionType('setstate', candidates)).toBe('setState')
  })

  it('字母拼错建议最近候选（setStae → setState）', () => {
    expect(suggestActionType('setStae', candidates)).toBe('setState')
  })

  it('插件自定义动作拼错建议（myPluginActon → myPluginAction）', () => {
    expect(suggestActionType('myPluginActon', candidates)).toBe('myPluginAction')
  })

  it('精确一致返回 undefined（非拼写错误）', () => {
    expect(suggestActionType('setState', candidates)).toBeUndefined()
  })

  it('无关输入返回 undefined', () => {
    expect(suggestActionType('zzzz', candidates)).toBeUndefined()
  })

  it('空输入返回 undefined', () => {
    expect(suggestActionType('', candidates)).toBeUndefined()
  })

  it('超过阈值返回 undefined', () => {
    expect(suggestActionType('se', candidates)).toBeUndefined()
  })
})

describe('collectActionCandidates / formatActionSuggestion', () => {
  function makeRegistry(): ActionRegistry {
    const registry = new ActionRegistry()
    registry.registerMany(createBuiltinActions())
    return registry
  }

  it('候选集包含标准动作 + 已注册 kind + 别名，且去重', () => {
    const candidates = collectActionCandidates(makeRegistry())
    expect(candidates).toContain('setState')
    expect(candidates).toContain('setProp')
    expect(candidates).toContain('request')
    expect(candidates).toContain('refresh')
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it('formatActionSuggestion 命中时返回「是否想写」片段', () => {
    const registry = makeRegistry()
    expect(formatActionSuggestion('setstate', registry)).toBe('，是否想写 setState？')
  })

  it('formatActionSuggestion 无建议时返回空串', () => {
    expect(formatActionSuggestion('zzzz', makeRegistry())).toBe('')
  })
})
