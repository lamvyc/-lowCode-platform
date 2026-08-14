import type { ExpressionContext, IExpressionEngine } from '../expression/engine'
import type { FormField, FormSchema, FormStatus } from './types'

export interface FormEngineOptions {
  schema: FormSchema
  expression: IExpressionEngine
  /** 提交处理（校验通过后调用）；抛错视为提交失败 */
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void
  /** 任意值/状态变化回调（Runtime 用它驱动 UI） */
  onChange?: () => void
}

/**
 * 表单引擎（纯 TS，不依赖 UI 框架）：
 * - 值 / 错误 / touched / dirty 状态机
 * - 字段校验（required / min / max / minLength / maxLength / pattern / enum / custom）
 * - 可见性 / 禁用表达式联动（$form / $record 作用域）
 * - validate / submit / reset
 */
export class FormEngine {
  readonly schema: FormSchema
  private readonly expression: IExpressionEngine
  private readonly onSubmit?: FormEngineOptions['onSubmit']
  private readonly listeners = new Set<() => void>()
  private values: Record<string, unknown>
  private errors: Record<string, string | undefined> = {}
  private touched: Record<string, boolean> = {}
  private dirty: Record<string, boolean> = {}
  status: FormStatus = 'idle'

  constructor(options: FormEngineOptions) {
    this.schema = options.schema
    this.expression = options.expression
    this.onSubmit = options.onSubmit
    if (options.onChange) this.listeners.add(options.onChange)
    this.values = {}
    for (const field of options.schema.fields) {
      this.values[field.name] = field.defaultValue
    }
  }

  /** 订阅任意状态变化，返回取消订阅函数 */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private field(name: string): FormField | undefined {
    return this.schema.fields.find((f) => f.name === name)
  }

  getValues(): Record<string, unknown> {
    return { ...this.values }
  }

  getValue(name: string): unknown {
    return this.values[name]
  }

  setValue(name: string, value: unknown): void {
    this.values[name] = value
    this.dirty[name] = true
    this.errors[name] = undefined
    this.notify()
  }

  setValues(values: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(values)) {
      this.values[name] = value
      this.dirty[name] = true
    }
    this.notify()
  }

  getError(name: string): string | undefined {
    return this.errors[name]
  }

  getErrors(): Record<string, string | undefined> {
    return { ...this.errors }
  }

  touch(name: string): void {
    this.touched[name] = true
    this.notify()
  }

  isTouched(name: string): boolean {
    return this.touched[name] === true
  }

  isDirty(name: string): boolean {
    return this.dirty[name] === true
  }

  /** 表单表达式上下文：$form / $record 均指向当前表单值 */
  buildContext(): ExpressionContext {
    return { form: this.values, record: this.values }
  }

  isFieldVisible(name: string): boolean {
    const field = this.field(name)
    if (!field || !field.visible) return true
    const result = this.expression.tryEvaluate<boolean>(field.visible, this.buildContext())
    return result.ok ? Boolean(result.value) : true
  }

  isFieldDisabled(name: string): boolean {
    const field = this.field(name)
    if (!field || !field.disabled) return false
    const result = this.expression.tryEvaluate<boolean>(field.disabled, this.buildContext())
    return result.ok ? Boolean(result.value) : false
  }

  /** 校验单个字段，返回错误信息（通过返回 undefined） */
  validateField(name: string): string | undefined {
    const field = this.field(name)
    if (!field) return undefined
    const value = this.values[name]
    const label = field.label ?? name
    const v = field.validation
    if (!v) return undefined

    if (v.required && (value === undefined || value === null || value === '')) {
      return `${label} 为必填项`
    }
    if (typeof value === 'number') {
      if (v.min !== undefined && value < v.min) return `${label} 不能小于 ${v.min}`
      if (v.max !== undefined && value > v.max) return `${label} 不能大于 ${v.max}`
    }
    if (typeof value === 'string' && value !== '') {
      if (v.minLength !== undefined && value.length < v.minLength) {
        return `${label} 长度不能小于 ${v.minLength}`
      }
      if (v.maxLength !== undefined && value.length > v.maxLength) {
        return `${label} 长度不能大于 ${v.maxLength}`
      }
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(value)) return `${label} 格式不正确`
        } catch {
          // 非法 pattern 忽略，不阻断校验
        }
      }
    }
    if (v.enum && !v.enum.some((option) => option === value)) {
      return `${label} 不在可选范围内`
    }
    if (v.custom) {
      const result = this.expression.tryEvaluate<boolean>(v.custom, this.buildContext())
      if (!result.ok || !result.value) return `${label} 未通过自定义校验`
    }
    return undefined
  }

  /** 校验全部可见字段，返回是否通过 */
  validate(): boolean {
    let ok = true
    for (const field of this.schema.fields) {
      if (!this.isFieldVisible(field.name)) continue
      const error = this.validateField(field.name)
      this.errors[field.name] = error
      if (error) ok = false
    }
    this.notify()
    return ok
  }

  /** 提交：校验通过 → onSubmit → status */
  async submit(): Promise<boolean> {
    this.status = 'validating'
    const valid = this.validate()
    if (!valid) {
      this.status = 'editing'
      return false
    }
    this.status = 'submitting'
    try {
      await this.onSubmit?.(this.getValues())
      this.status = 'submitted'
      this.notify()
      return true
    } catch (error) {
      this.status = 'editing'
      throw error
    }
  }

  reset(): void {
    this.values = {}
    for (const field of this.schema.fields) this.values[field.name] = field.defaultValue
    this.errors = {}
    this.touched = {}
    this.dirty = {}
    this.status = 'idle'
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
