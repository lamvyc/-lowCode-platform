import type { PageNode } from '@lowcode/schema'
import type { MappingContext } from './mappings/types'
import type { CodegenPlan } from './plan'

/**
 * 内置校验正则：与 `@lowcode/core` 的 `BUILTIN_PATTERNS` 逐条一致。
 * codegen 不引入 core 作为运行时依赖，靠单测对表防止漂移。
 */
export const BUILTIN_VALIDATION_PATTERNS: Record<string, string> = {
  number: '^[-]?\\d+(\\.\\d+)?$',
  letter: '^[A-Za-z]+$',
  letterAndNumber: '^[A-Za-z0-9]+$',
  mobilePhone: '^[1][3-9][0-9]{9}$',
  letterStartNumberIncluded: '^[A-Za-z]+[A-Za-z\\d]*$',
  noChinese: '^[^\\u4e00-\\u9fa5]+$',
  chinese: '^[\\u4e00-\\u9fa5]+$',
  email: '^([-_A-Za-z0-9.]+)@([_A-Za-z0-9]+\\.)+[A-Za-z0-9]{2,3}$',
  url: '^([hH][tT]{2}[pP]:\\/\\/|[hH][tT]{2}[pP][sS]:\\/\\/)(([A-Za-z0-9-~]+)\\.)+([A-Za-z0-9-~\\/])+$',
}

/** 内置校验默认文案（与 core 的 BUILTIN_MESSAGES 一致） */
export const BUILTIN_VALIDATION_MESSAGES: Record<string, (label: string) => string> = {
  number: (label) => `[${label}]包含非数字字符`,
  letter: (label) => `[${label}]包含非字母字符`,
  letterAndNumber: (label) => `[${label}]只能输入字母或数字`,
  mobilePhone: (label) => `[${label}]手机号码格式有误`,
  letterStartNumberIncluded: (label) => `[${label}]必须以字母开头，可包含数字`,
  noChinese: (label) => `[${label}]不可输入中文字符`,
  chinese: (label) => `[${label}]只能输入中文字符`,
  email: (label) => `[${label}]邮箱格式有误`,
  url: (label) => `[${label}]URL格式有误`,
}

const TRIGGER = "['blur', 'change']"

function indent(code: string, spaces = 2): string {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n')
}

function ruleObject(lines: string[]): string {
  return `  {\n${lines.map((line) => `    ${line}`).join('\n')}\n  },`
}

function fieldLabel(node: PageNode, ctx: MappingContext): string {
  return typeof node.props.label === 'string' && node.props.label !== ''
    ? node.props.label
    : ctx.modelKey(node)
}

/**
 * 字段校验规则：required / validation（内置名或正则）/ minLength / maxLength / onValidate。
 * 返回 JS 对象字面量片段数组；非法正则跳过并写 warning。
 */
export function buildRulesForField(node: PageNode, ctx: MappingContext): string[] {
  const rules: string[] = []
  const label = fieldLabel(node, ctx)

  if (node.props.required === true) {
    const message =
      typeof node.props.requiredHint === 'string' && node.props.requiredHint !== ''
        ? node.props.requiredHint
        : '字段值不可为空'
    rules.push(
      ruleObject([
        'required: true,',
        `message: ${JSON.stringify(message)},`,
        `trigger: ${TRIGGER},`,
      ]),
    )
  }

  if (typeof node.props.validation === 'string' && node.props.validation !== '') {
    const validation = node.props.validation
    const hint = typeof node.props.validationHint === 'string' ? node.props.validationHint : ''
    const builtinPattern = BUILTIN_VALIDATION_PATTERNS[validation]
    if (builtinPattern) {
      const message = hint || BUILTIN_VALIDATION_MESSAGES[validation](label)
      rules.push(
        ruleObject([
          `pattern: /${builtinPattern}/,`,
          `message: ${JSON.stringify(message)},`,
          `trigger: ${TRIGGER},`,
        ]),
      )
    } else {
      try {
        // 自定义正则用 new RegExp 生成，避免用户输入里的 / 破坏字面量
        new RegExp(validation)
        rules.push(
          ruleObject([
            `pattern: new RegExp(${JSON.stringify(validation)}),`,
            `message: ${JSON.stringify(hint || `[${label}]invalid value`)},`,
            `trigger: ${TRIGGER},`,
          ]),
        )
      } catch {
        ctx.warn(
          'invalid-pattern',
          `字段「${label}」的校验正则非法，已跳过: ${validation}`,
          node.id,
        )
      }
    }
  }

  if (typeof node.props.minLength === 'number' && node.props.minLength > 0) {
    rules.push(
      ruleObject([
        `min: ${node.props.minLength},`,
        `message: ${JSON.stringify(`[${label}]至少 ${node.props.minLength} 个字符`)},`,
        `trigger: ${TRIGGER},`,
      ]),
    )
  }
  if (typeof node.props.maxLength === 'number' && node.props.maxLength > 0) {
    rules.push(
      ruleObject([
        `max: ${node.props.maxLength},`,
        `message: ${JSON.stringify(`[${label}]最多 ${node.props.maxLength} 个字符`)},`,
        `trigger: ${TRIGGER},`,
      ]),
    )
  }

  if (typeof node.props.onValidate === 'string' && node.props.onValidate.trim() !== '') {
    rules.push(
      [
        '  {',
        '    validator: (rule, value, callback) => {',
        '      try {',
        indent(node.props.onValidate, 8),
        '      } catch (error) {',
        '        callback(error)',
        '      }',
        '    },',
        '  },',
      ].join('\n'),
    )
  }

  return rules
}

/** 生成 rules 对象字面量（不含 `const rulesName =` 外壳） */
export function buildRulesObject(plan: CodegenPlan, ctx: MappingContext): string {
  const entries: string[] = []
  for (const node of plan.fieldNodes) {
    const rules = buildRulesForField(node, ctx)
    if (rules.length === 0) continue
    const key = plan.modelKeys.get(node.id) ?? node.id
    entries.push(`  ${key}: [\n${rules.join('\n')}\n  ],`)
  }
  return entries.length > 0 ? `{\n${entries.join('\n')}\n}` : '{}'
}
