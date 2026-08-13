/** 页面变量：运行时状态，可被表达式引用 */
export interface PageVariable {
  id: string
  name: string
  value: unknown
  /** 是否持久化到 localStorage */
  persistent?: boolean
}
