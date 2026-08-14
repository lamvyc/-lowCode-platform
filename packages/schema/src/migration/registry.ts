import { normalizeEventAction } from '../types/action'
import type { DataSource } from '../types/datasource'
import type { PageSchema } from '../types/page'
import type { PageSpec, UnifiedDataSource, UnifiedPageSchema } from '../types/pageSpec'
import type { SchemaChange } from '../types/schema'
import {
  SCHEMA_VERSION,
  UNIFIED_SCHEMA_VERSION,
  parsePageSchema,
  parseSchema,
} from '../validation/validate'

/** 一次迁移：从 from 版本到 to 版本 */
export interface Migration {
  from: string
  to: string
  migrate: (schema: unknown) => unknown
}

/** 迁移注册表：支持任意版本的链式迁移 */
export class MigrationRegistry {
  private items: Migration[] = []

  register(migration: Migration): void {
    if (this.items.some((m) => m.from === migration.from && m.to === migration.to)) {
      throw new Error(`迁移已注册: ${migration.from} -> ${migration.to}`)
    }
    this.items.push(migration)
  }

  /** 查找 from → to 的迁移路径（BFS） */
  findPath(from: string, to: string): Migration[] {
    if (from === to) return []
    const queue: { version: string; path: Migration[] }[] = [{ version: from, path: [] }]
    const visited = new Set<string>([from])

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const migration of this.items) {
        if (migration.from !== current.version || visited.has(migration.to)) continue
        const path = [...current.path, migration]
        if (migration.to === to) return path
        visited.add(migration.to)
        queue.push({ version: migration.to, path })
      }
    }
    return []
  }
}

/**
 * 将任意版本 schema 迁移到当前版本。
 * 无迁移路径时抛错，避免静默使用错误数据。
 */
export function migratePageSchema(
  schema: unknown,
  registry: MigrationRegistry = new MigrationRegistry(),
): PageSchema {
  const version = (schema as { version?: unknown }).version
  if (typeof version !== 'string') {
    throw new Error('无法迁移：schema 缺少 version 字段')
  }
  const path = registry.findPath(version, SCHEMA_VERSION)
  let current: unknown = schema
  for (const migration of path) {
    current = migration.migrate(current)
  }
  return parsePageSchema(current)
}

/** 旧版扁平 DataSource → 统一声明式数据源（P6：引用外部 API/DataModel） */
function mapLegacyDataSource(ds: DataSource): UnifiedDataSource {
  switch (ds.type) {
    case 'rest':
      return {
        id: ds.id,
        name: ds.name,
        type: 'API',
        ref: ds.id,
        params: ds.config.params,
        pollInterval: ds.config.pollInterval,
      }
    case 'static':
      return { id: ds.id, name: ds.name, type: 'static', value: ds.config.staticData }
    case 'localStorage':
    case 'sessionStorage':
      return { id: ds.id, name: ds.name, type: ds.type, storageKey: ds.config.storageKey }
    case 'pageVariable':
      return { id: ds.id, name: ds.name, type: 'pageVariable', variableId: ds.config.variableId }
    case 'DataModel':
      return {
        id: ds.id,
        name: ds.name,
        type: 'DataModel',
        ref: ds.config.modelRef ?? '',
        operation: ds.config.operation ?? 'query',
        filter: ds.config.filter,
      }
    case 'API':
      return {
        id: ds.id,
        name: ds.name,
        type: 'API',
        ref: ds.config.apiRef ?? '',
        params: ds.config.params,
        pollInterval: ds.config.pollInterval,
      }
  }
}

/**
 * 旧版扁平 PageSchema（1.x）→ 统一 PageSchema（2.x）
 * P5：结构变更提供 migration 说明，废弃字段不直接删除。
 */
export function migrateToUnified(input: unknown): UnifiedPageSchema {
  const legacy = parsePageSchema(input)
  const changes: SchemaChange[] = [
    { field: 'rules/actions', deprecated: true, alternative: 'interactions' },
    { field: 'EventAction.kind', deprecated: true, alternative: 'EventAction.type（标准枚举）' },
    { field: 'EventAction.config', deprecated: true, alternative: 'EventAction.target/params' },
    { field: 'EventAction.when', deprecated: true, alternative: 'EventAction.expression' },
    {
      field: 'EventAction.children/catch/continueOnError',
      deprecated: true,
      reason: '动作链控制流移出声明层（P1），流程编排由 Process Schema 承担',
    },
    {
      field: 'DataSource.config.url/method',
      deprecated: true,
      alternative: 'DataSource{type:"API", ref} + ApiSchema 声明',
    },
    {
      field: '$datasource.* 表达式上下文',
      deprecated: true,
      alternative: '$state / $api / $props（P3 沙箱上下文）',
    },
  ]

  const spec: PageSpec = {
    route: legacy.meta.route,
    nodes: legacy.nodes.map((node) => ({
      ...node,
      events: node.events
        ? Object.fromEntries(
            Object.entries(node.events).map(([eventName, actions]) => [
              eventName,
              actions.map(normalizeEventAction),
            ]),
          )
        : undefined,
    })),
    materials: legacy.materials.length > 0 ? legacy.materials : undefined,
    dataSources:
      legacy.dataSources.length > 0 ? legacy.dataSources.map(mapLegacyDataSource) : undefined,
    variables: legacy.variables.length > 0 ? legacy.variables : undefined,
    interactions: legacy.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      trigger: rule.trigger,
      expression: rule.condition,
      actions: rule.actions.map(normalizeEventAction),
      debounceMs: rule.debounceMs,
      dependsOn: rule.dependsOn,
    })),
    settings: legacy.settings,
  }

  const envelope: UnifiedPageSchema = {
    version: UNIFIED_SCHEMA_VERSION,
    kind: 'Page',
    metadata: {
      id: legacy.meta.id,
      name: legacy.meta.name,
      description: legacy.meta.description,
      createdAt: legacy.meta.createdAt,
      updatedAt: legacy.meta.updatedAt,
    },
    spec,
    migrations: [{ from: legacy.version, to: UNIFIED_SCHEMA_VERSION, changes }],
  }
  return parseSchema(envelope) as UnifiedPageSchema
}
