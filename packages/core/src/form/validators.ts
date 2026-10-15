/**
 * 内置字段校验器。
 *
 * 从参考实现 `variant-form/src/utils/validators.js` 逐条移植，保留其两条关键语义：
 *
 * 1. **空值不校验** —— `required` 由独立的必填规则负责，内置校验器遇到空值直接放行，
 *    两者不重叠。否则"非必填 + 邮箱格式"在空输入时会误报。
 * 2. **按 `length` 判空** —— 因此 `number` / `boolean` 不会被当作空值（`undefined <= 0` 为 false），
 *    会继续走正则。这是参考实现的可观察行为，照搬。
 *
 * 与参考实现的差异（有意）：
 * - 参考用 `eval('/^...$/')` 从字符串还原正则；这里用 `new RegExp(pattern)`，去掉 `eval`。
 * - 参考是 callback 风格（Element UI 契约）；这里返回 `string | undefined`（错误文案或通过），
 *   更便于纯函数测试与接入任何 UI。
 */

/** 内置校验器名 → 正则源码（不含首尾斜杠，交给 `new RegExp`） */
export const BUILTIN_PATTERNS: Readonly<Record<string, string>> = {
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

/** 内置校验器默认错误文案（`label` 为字段标签） */
const BUILTIN_MESSAGES: Readonly<Record<string, (label: string) => string>> = {
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

export interface FieldValidatorOptions {
  /** 字段标签，用于拼默认错误文案 */
  label: string
  /** 自定义错误文案（对应 schema 的 validationHint），优先于默认文案 */
  errorMsg?: string
}

/**
 * 是否视为空值。
 *
 * 严格照搬参考实现：`isNull(value) || value.length <= 0`，
 * 其中 `isNull` 只判 `null` / `undefined`。
 * 因此 `0`、`false` **不算空值**（它们的 `length` 是 `undefined`，`undefined <= 0` 为 false）。
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const length = (value as { length?: unknown }).length
  return typeof length === 'number' && length <= 0
}

/**
 * 参考实现声明了 `noBlankStart` / `noBlankEnd` 但**是空实现**（`variants.js` 注释"暂未实现"）。
 * 这里显式列出，避免被误认为已支持。
 */
export const UNIMPLEMENTED_VALIDATORS: readonly string[] = ['noBlankStart', 'noBlankEnd']

function testPattern(pattern: string, value: unknown): boolean {
  try {
    return new RegExp(pattern).test(String(value))
  } catch {
    // 非法正则不阻断：与参考实现"忽略非法 pattern"的取向一致
    return true
  }
}

/** 按内置校验器名校验；名字未命中或未实现时视为通过 */
export function runBuiltinValidator(
  name: string,
  value: unknown,
  options: FieldValidatorOptions,
): string | undefined {
  if (UNIMPLEMENTED_VALIDATORS.includes(name)) return undefined
  const pattern = BUILTIN_PATTERNS[name]
  const buildMessage = BUILTIN_MESSAGES[name]
  if (!pattern || !buildMessage) return undefined
  if (isEmptyValue(value)) return undefined
  if (testPattern(pattern, value)) return undefined
  return options.errorMsg || buildMessage(options.label)
}

/** 按正则字符串校验（对应参考实现的 `FormValidators.regExp`） */
export function runPatternValidator(
  pattern: string,
  value: unknown,
  options: FieldValidatorOptions,
): string | undefined {
  if (isEmptyValue(value)) return undefined
  if (testPattern(pattern, value)) return undefined
  return options.errorMsg || `[${options.label}]invalid value`
}

/**
 * 统一入口：`validation` 命中内置名时走内置校验器，否则当作正则字符串。
 * 与参考实现 `buildFieldRules` 的分支完全一致。
 */
export function runValidation(
  validation: string,
  value: unknown,
  options: FieldValidatorOptions,
): string | undefined {
  if (BUILTIN_PATTERNS[validation]) return runBuiltinValidator(validation, value, options)
  return runPatternValidator(validation, value, options)
}

/**
 * 必填规则。
 *
 * 错误文案 = `requiredHint || i18n('render.hint.fieldRequired')`（zh 为「字段值不可为空」）——
 * 注意**不**加 `[label]` 前缀，与内置格式校验器的文案风格不同（参考实现即如此）。
 */
export function runRequiredValidator(
  value: unknown,
  options: FieldValidatorOptions,
): string | undefined {
  const empty =
    value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
  if (!empty) return undefined
  return options.errorMsg || '字段值不可为空'
}
