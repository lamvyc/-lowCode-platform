import type { PageSchema } from '../types/page'
import type { ApiSchema, ApiSpec } from '../types/api'
import type { DataModelSchema, DataModelSpec } from '../types/datamodel'
import type { PageSpec, UnifiedPageSchema } from '../types/pageSpec'
import type { PluginSchema, PluginSpec } from '../types/plugin'
import type { ProcessSchema, ProcessSpec } from '../types/process'
import type {
  SchemaEnvelope,
  SchemaKind,
  SchemaMetadata,
  SchemaMigration,
} from '../types/schema'
import { SCHEMA_KINDS } from '../types/schema'
import { pageSchemaSchema, schemaEnvelopeSchema, semverSchema } from './schema.zod'

/** 旧版扁平 PageSchema 协议版本（已废弃，P5：不删除、提供迁移） */
export const SCHEMA_VERSION = '1.0.0'

/** 统一五层 Schema 协议版本 */
export const UNIFIED_SCHEMA_VERSION = '2.0.0'

/** 语义化版本号判断（P5） */
export function isSemver(version: string): boolean {
  return semverSchema.safeParse(version).success
}

/** 校验并返回类型安全的 PageSchema */
export function parsePageSchema(input: unknown): PageSchema {
  return pageSchemaSchema.parse(input) as PageSchema
}

/** 类型守卫：输入是否为合法 PageSchema */
export function isPageSchema(input: unknown): input is PageSchema {
  return pageSchemaSchema.safeParse(input).success
}

/** 校验并返回任意层的统一 Schema（version/kind/metadata/spec/migrations） */
export function parseSchema(input: unknown): SchemaEnvelope {
  return schemaEnvelopeSchema.parse(input)
}

/** 类型守卫：输入是否为合法统一 Schema 信封 */
export function isSchemaEnvelope(input: unknown): input is SchemaEnvelope {
  return schemaEnvelopeSchema.safeParse(input).success
}

/** 读取 Schema kind（非法输入返回 undefined） */
export function getSchemaKind(input: unknown): SchemaKind | undefined {
  if (!input || typeof input !== 'object') return undefined
  const kind = (input as { kind?: unknown }).kind
  return typeof kind === 'string' && SCHEMA_KINDS.includes(kind as SchemaKind)
    ? (kind as SchemaKind)
    : undefined
}

export interface SchemaMetaInput {
  id: string
  name: string
  description?: string
  tags?: string[]
}

function makeMetadata(input: SchemaMetaInput): SchemaMetadata {
  const now = new Date().toISOString()
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  }
}

/** 创建统一 Schema 信封（未校验；校验入口为 parseSchema） */
export function createSchema<K extends SchemaKind, S>(
  kind: K,
  meta: SchemaMetaInput,
  spec: S,
  migrations?: SchemaMigration[],
): SchemaEnvelope<K, S> {
  return {
    version: UNIFIED_SCHEMA_VERSION,
    kind,
    metadata: makeMetadata(meta),
    spec,
    migrations,
  }
}

export function createUnifiedPageSchema(
  meta: SchemaMetaInput,
  spec: PageSpec,
  migrations?: SchemaMigration[],
): UnifiedPageSchema {
  return createSchema('Page', meta, spec, migrations) as UnifiedPageSchema
}

export function createDataModelSchema(
  meta: SchemaMetaInput,
  spec: DataModelSpec,
  migrations?: SchemaMigration[],
): DataModelSchema {
  return createSchema('DataModel', meta, spec, migrations) as DataModelSchema
}

export function createProcessSchema(
  meta: SchemaMetaInput,
  spec: ProcessSpec,
  migrations?: SchemaMigration[],
): ProcessSchema {
  return createSchema('Process', meta, spec, migrations) as ProcessSchema
}

export function createApiSchema(
  meta: SchemaMetaInput,
  spec: ApiSpec,
  migrations?: SchemaMigration[],
): ApiSchema {
  return createSchema('API', meta, spec, migrations) as ApiSchema
}

export function createPluginSchema(
  meta: SchemaMetaInput,
  spec: PluginSpec,
  migrations?: SchemaMigration[],
): PluginSchema {
  return createSchema('Plugin', meta, spec, migrations) as PluginSchema
}

/** 创建一份空的默认页面 */
export function createEmptySchema(
  meta: Pick<PageMetaInput, 'id' | 'name' | 'description' | 'route'>,
): PageSchema {
  const now = new Date().toISOString()
  return parsePageSchema({
    version: SCHEMA_VERSION,
    meta: {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      route: meta.route,
      createdAt: now,
      updatedAt: now,
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: {
      layout: { mode: 'free' },
    },
  })
}

/** 仅用于类型标注，避免循环依赖 */
type PageMetaInput = {
  id: string
  name: string
  description?: string
  route?: string
}
