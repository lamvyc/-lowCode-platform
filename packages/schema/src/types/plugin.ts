import type { RemoteMaterialMeta } from './material'
import type { SchemaEnvelope } from './schema'

/** 自定义组件声明：identifier + JSON Schema 属性面板 + 插件接口（P4） */
export interface PluginComponentDeclaration {
  identifier: string
  /** JSON Schema 格式的属性面板定义 */
  propertySchema: Record<string, unknown>
  /** 差异化能力通过 plugin interface 注入，如 chart-plugin */
  pluginInterface?: string
  category?: string
  slots?: string[]
  remote?: RemoteMaterialMeta
}

export interface PluginSpec {
  componentRegistry?: {
    builtin?: string[]
    custom?: PluginComponentDeclaration[]
  }
  /** 自定义 Action 类型标识（需引擎注册对应实现） */
  actionTypes?: string[]
  /** 注册到表达式引擎的纯函数 */
  expressionFunctions?: Array<{ name: string; description?: string }>
  /** 插件入口/清单地址 */
  entry?: string
}

export interface PluginSchema extends SchemaEnvelope<'Plugin', PluginSpec> {}
