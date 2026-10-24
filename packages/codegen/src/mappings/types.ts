import type { PageNode, PageSchema } from '@lowcode/schema'
import type { TemplateNode } from '../ast'
import type { CodegenWarning, ResolvedForm } from '../types'

/** 模板/脚本两种表达式重写模式 */
export type CodegenMode = 'template' | 'script'

/** 映射函数运行时上下文 */
export interface MappingContext {
  schema: PageSchema
  nodes: Map<string, PageNode>
  datasourceIds: string[]
  variableNames: string[]
  form: ResolvedForm
  mode: CodegenMode
  warnings: CodegenWarning[]
  warn(code: string, message: string, nodeId?: string): void
  modelKey(node: PageNode): string
  prop(node: PageNode, name: string): unknown
  renderNode(node: PageNode): TemplateNode
  renderChildren(node: PageNode): TemplateNode[]
}

/**
 * 单个物料的 Element Plus 映射。
 * `field` 决定是否包 el-form-item、写 formData；不再依赖 `'modelValue' in props`。
 */
export interface ElementMapping {
  tag: string
  field?: boolean
  /** 额外导入（默认由 tag 推导 ElXxx from element-plus） */
  imports?: Array<{ name: string; from: string }>
  /** 模板属性（不含通用 style/class/v-if/v-for） */
  attrs: (node: PageNode, ctx: MappingContext) => Record<string, string>
  /** 自定义渲染，默认 tag + 子节点 */
  render?: (node: PageNode, ctx: MappingContext) => TemplateNode
  /** 字段缺省值（Schema 未声明 modelValue 时使用） */
  initialValue?: (node: PageNode) => unknown
  /** 额外 setup 代码（如 tab active、卡片折叠） */
  setup?: (node: PageNode, ctx: MappingContext) => string[]
  /** 额外校验规则（JS 对象字面量字符串） */
  rules?: (node: PageNode, ctx: MappingContext) => string[]
}

/** 自定义物料组件逃生口：仍想复用平台组件时使用 */
export interface ComponentMapping {
  tag: string
  importName: string
  from: string
}

export interface MappingRegistry {
  register(type: string, mapping: ElementMapping): void
  get(type: string): ElementMapping | undefined
  registerComponent(type: string, entry: ComponentMapping): void
  component(type: string): ComponentMapping | undefined
}
