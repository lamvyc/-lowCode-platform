import type { PageSchema } from '@lowcode/schema'
import { rewriteExpression } from './expressions'

export interface RuleRuntimeOptions {
  datasourceIds: string[]
  variableNames: string[]
}

export interface RuleRuntime {
  lines: string[]
  needsWatch: boolean
  needsMounted: boolean
}

/** 生成 schema.rules 的条件表与 runRules(trigger) */
export function buildRuleRuntime(schema: PageSchema, options: RuleRuntimeOptions): RuleRuntime {
  const rules = schema.rules ?? []
  const lines: string[] = []
  const conditions: string[] = []
  let needsWatch = false
  let needsMounted = false

  for (const rule of rules) {
    if (rule.enabled === false) continue
    const expression = rule.expression ?? rule.condition
    if (expression) {
      const rewritten = rewriteExpression(
        expression,
        options.datasourceIds,
        options.variableNames,
        'script',
      )
      conditions.push(`  ${JSON.stringify(rule.id)}: () => ${rewritten},`)
    }
    if (rule.trigger === 'expression') needsWatch = true
    if (rule.trigger === 'mount') needsMounted = true
  }

  lines.push('const ruleConditions = {')
  lines.push(...conditions)
  lines.push('}')
  lines.push('')
  lines.push('function runRules(trigger) {')
  lines.push('  const rules = ' + JSON.stringify(rules.map((rule) => ({
    id: rule.id,
    enabled: rule.enabled !== false,
    trigger: rule.trigger,
    actions: rule.actions,
  })), null, 2))
  lines.push('  for (const rule of rules) {')
  lines.push('    if (!rule.enabled || rule.trigger !== trigger) continue')
  lines.push('    try {')
  lines.push('      const condition = ruleConditions[rule.id]')
  lines.push('      if (condition && !condition()) continue')
  lines.push('      for (const action of rule.actions) {')
  lines.push('        runAction(action, null, rule.id)')
  lines.push('      }')
  lines.push('    } catch (error) {')
  lines.push("      console.warn('[codegen] 规则执行失败', rule.id, error)")
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('')

  return { lines, needsWatch, needsMounted }
}
