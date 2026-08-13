/**
 * 统一绑定抽象：任何属性都可以是「静态值」或「表达式」。
 * Props / Style / Visible / Loop / DataSource / Rule 共用这一抽象。
 */
export type Binding<T = unknown> =
  | {
      type: 'static'
      value: T
    }
  | {
      type: 'expression'
      value: string
    }

/** 类型守卫：判断一个绑定是否为表达式绑定 */
export function isExpressionBinding(value: unknown): value is { type: 'expression'; value: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'expression' &&
    typeof (value as { value?: unknown }).value === 'string'
  )
}

/** 类型守卫：判断一个绑定是否为静态绑定 */
export function isStaticBinding(value: unknown): value is { type: 'static'; value: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'static'
  )
}
