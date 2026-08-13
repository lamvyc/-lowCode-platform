/** jexl 2.x 未内置类型声明，这里声明本项目使用的最小 API 面 */
declare module 'jexl' {
  export interface JexlExpression {
    evalSync(context: Record<string, unknown>): unknown
    eval(context: Record<string, unknown>): Promise<unknown>
  }

  export class Jexl {
    createExpression(expression: string): JexlExpression
    addFunction(name: string, fn: (...args: never[]) => unknown): void
  }
}
