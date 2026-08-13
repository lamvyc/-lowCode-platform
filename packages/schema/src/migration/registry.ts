import { SCHEMA_VERSION, parsePageSchema } from '../validation/validate'
import type { PageSchema } from '../types/page'

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
