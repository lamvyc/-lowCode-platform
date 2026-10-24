import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { generateVueSfc } from './generator'

function schemaWithRule(trigger: 'mount' | 'expression' | 'event'): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p1', name: '规则', createdAt: '', updatedAt: '' },
    nodes: [
      {
        id: 'b1',
        name: 'go',
        type: 'button',
        props: { label: '去' },
        events: { click: [] },
      },
    ],
    materials: [],
    dataSources: [],
    variables: [{ id: 'v1', name: 'show', value: true }],
    rules: [
      {
        id: 'r1',
        name: '跳转',
        enabled: true,
        trigger,
        condition: '$page.show',
        actions: [{ id: 'a1', kind: 'navigate', config: { route: '#/x' } }],
      },
    ],
  }
}

describe('schema.rules', () => {
  it('mount 规则生成条件表并在 onMounted 调用', async () => {
    const { code } = await generateVueSfc(schemaWithRule('mount'))
    expect(code).toContain('function runRules(trigger)')
    expect(code).toContain('ruleConditions')
    expect(code).toContain('show.value')
    expect(code).toContain("runRules('mount')")
    expect(code).toContain('onMounted(')
  })

  it('expression 规则生成 deep watch', async () => {
    const { code } = await generateVueSfc(schemaWithRule('expression'))
    expect(code).toContain("runRules('expression')")
    expect(code).toContain('watch(')
    expect(code).toContain('deep: true')
  })

  it('event 规则在事件处理器末尾触发', async () => {
    const { code } = await generateVueSfc(schemaWithRule('event'))
    expect(code).toContain("runRules('event')")
  })
})
