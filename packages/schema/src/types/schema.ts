/**
 * 统一 Schema 骨架（P5 版本化与兼容）
 *
 * 所有 Schema 统一遵循顶层结构：
 * { version, kind, metadata, spec, migrations }
 *
 * - version: 语义化版本号 major.minor.patch
 * - kind:    Page | DataModel | Process | API | Plugin
 * - metadata: 全局唯一 id 与审计信息
 * - spec:    各层专属结构（Page / DataModel / Process / API / Plugin）
 * - migrations: 版本迁移记录（可选）
 */

/** 五层 Schema 类型标识（PascalCase 常量） */
export type SchemaKind = 'Page' | 'DataModel' | 'Process' | 'API' | 'Plugin'

export const SCHEMA_KINDS: readonly SchemaKind[] = [
  'Page',
  'DataModel',
  'Process',
  'API',
  'Plugin',
]

/** 统一元信息 */
export interface SchemaMetadata {
  id: string
  name: string
  description?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

/** 单条结构变更说明 */
export interface SchemaChange {
  field: string
  /** 是否废弃（P5：废弃字段不删除，注明替代方案） */
  deprecated?: boolean
  /** 替代方案 */
  alternative?: string
  /** 变更原因 */
  reason?: string
}

/** 版本迁移记录：from -> to + 变更清单 */
export interface SchemaMigration {
  from: string
  to: string
  changes: SchemaChange[]
}

/** 统一 Schema 信封：所有层的公共外壳 */
export interface SchemaEnvelope<K extends SchemaKind = SchemaKind, S = unknown> {
  version: string
  kind: K
  metadata: SchemaMetadata
  spec: S
  migrations?: SchemaMigration[]
}
