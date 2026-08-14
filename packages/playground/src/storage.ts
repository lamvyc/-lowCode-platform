import { MemoryStorage } from '@lowcode/core'
import {
  isSchemaEnvelope,
  parsePageSchema,
  parseSchema,
  type PageSchema,
  type UnifiedPageSchema,
} from '@lowcode/schema'

/** 页面 Schema：旧版扁平或统一结构（kind: Page） */
export type AnyPageSchema = PageSchema | UnifiedPageSchema

export interface StoredPage {
  id: string
  name: string
  updatedAt: string
  schema: AnyPageSchema
}

export interface PageVersion {
  id: string
  at: string
  schema: AnyPageSchema
}

export interface StoredTemplate {
  id: string
  name: string
  description?: string
  createdAt: string
  schema: AnyPageSchema
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const PAGES_KEY = 'lc.pages'
const TEMPLATES_KEY = 'lc.templates'
const VERSION_PREFIX = 'lc.versions.'
const MAX_VERSIONS = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStoredPage(value: unknown): value is StoredPage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.updatedAt === 'string' &&
    'schema' in value
  )
}

function isStoredTemplate(value: unknown): value is StoredTemplate {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    'schema' in value
  )
}

function isUnified(schema: AnyPageSchema): schema is UnifiedPageSchema {
  return isSchemaEnvelope(schema)
}

function pageId(schema: AnyPageSchema): string {
  return isUnified(schema) ? schema.metadata.id : schema.meta.id
}

function pageName(schema: AnyPageSchema): string {
  return isUnified(schema) ? schema.metadata.name : schema.meta.name
}

/** 校验并返回任意形式的页面 Schema（旧版或统一） */
function parseAnyPageSchema(input: unknown): AnyPageSchema {
  if (isSchemaEnvelope(input)) return parseSchema(input) as UnifiedPageSchema
  return parsePageSchema(input)
}

/** 统一仓储：所有本地存储都通过可替换的 StorageLike 后端读写，并校验 PageSchema */
export class StorageRepository {
  constructor(private readonly storage: StorageLike) {}

  loadPages(): StoredPage[] {
    const items = this.readJson<unknown[]>(PAGES_KEY, [])
    if (!Array.isArray(items)) return []
    return items.flatMap((item) => {
      if (!isStoredPage(item)) return []
      try {
        return [{
          id: item.id,
          name: item.name,
          updatedAt: item.updatedAt,
          schema: parseAnyPageSchema(item.schema),
        }]
      } catch {
        return []
      }
    })
  }

  getPage(id: string): StoredPage | undefined {
    return this.loadPages().find((page) => page.id === id)
  }

  savePage(schema: AnyPageSchema): StoredPage {
    const validSchema = parseAnyPageSchema(schema)
    const pages = this.loadPages()
    const now = new Date().toISOString()
    const stored: StoredPage = {
      id: pageId(validSchema),
      name: pageName(validSchema),
      updatedAt: now,
      schema: validSchema,
    }
    const existing = pages.find((page) => page.id === stored.id)
    if (existing) {
      Object.assign(existing, stored)
    } else {
      pages.push(stored)
    }
    this.writeJson(PAGES_KEY, pages)
    return stored
  }

  deletePage(id: string): void {
    this.writeJson(
      PAGES_KEY,
      this.loadPages().filter((page) => page.id !== id),
    )
    this.storage.removeItem(`${VERSION_PREFIX}${id}`)
  }

  addVersion(pageIdKey: string, schema: AnyPageSchema): void {
    const validSchema = parseAnyPageSchema(schema)
    const versions = this.listVersions(pageIdKey)
    versions.unshift({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      schema: validSchema,
    })
    this.writeJson(`${VERSION_PREFIX}${pageIdKey}`, versions.slice(0, MAX_VERSIONS))
  }

  listVersions(pageId: string): PageVersion[] {
    const items = this.readJson<unknown[]>(`${VERSION_PREFIX}${pageId}`, [])
    if (!Array.isArray(items)) return []
    return items.flatMap((item) => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.at !== 'string' ||
        !('schema' in item)
      ) {
        return []
      }
      try {
        return [{ id: item.id, at: item.at, schema: parseAnyPageSchema(item.schema) }]
      } catch {
        return []
      }
    })
  }

  rollback(pageId: string, versionId: string): AnyPageSchema | undefined {
    const version = this.listVersions(pageId).find((item) => item.id === versionId)
    return version ? (JSON.parse(JSON.stringify(version.schema)) as AnyPageSchema) : undefined
  }

  listTemplates(): StoredTemplate[] {
    const items = this.readJson<unknown[]>(TEMPLATES_KEY, [])
    if (!Array.isArray(items)) return []
    return items.flatMap((item) => {
      if (!isStoredTemplate(item)) return []
      try {
        return [{
          ...item,
          schema: parseAnyPageSchema(item.schema),
        }]
      } catch {
        return []
      }
    })
  }

  saveTemplate(
    schema: AnyPageSchema,
    name?: string,
    description?: string,
  ): StoredTemplate {
    const validSchema = parseAnyPageSchema(schema)
    const templates = this.listTemplates()
    const template: StoredTemplate = {
      id: `template_${Date.now().toString(36)}`,
      name: name ?? `${pageName(validSchema)}模板`,
      description,
      createdAt: new Date().toISOString(),
      schema: JSON.parse(JSON.stringify(validSchema)) as AnyPageSchema,
    }
    templates.unshift(template)
    this.writeJson(TEMPLATES_KEY, templates)
    return template
  }

  deleteTemplate(id: string): void {
    this.writeJson(
      TEMPLATES_KEY,
      this.listTemplates().filter((template) => template.id !== id),
    )
  }

  templateToPage(template: StoredTemplate): AnyPageSchema {
    const schema = JSON.parse(JSON.stringify(template.schema)) as AnyPageSchema
    const now = new Date().toISOString()
    if (isUnified(schema)) {
      schema.metadata = {
        ...schema.metadata,
        id: `page_${Date.now().toString(36)}`,
        name: `${template.name} 副本`,
        createdAt: now,
        updatedAt: now,
      }
    } else {
      schema.meta = {
        ...schema.meta,
        id: `page_${Date.now().toString(36)}`,
        name: `${template.name} 副本`,
        createdAt: now,
        updatedAt: now,
      }
    }
    return schema
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  private writeJson(key: string, value: unknown): void {
    this.storage.setItem(key, JSON.stringify(value))
  }
}

function createDefaultRepository(): StorageRepository {
  const storage: StorageLike =
    typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage()
  return new StorageRepository(storage)
}

const repository = createDefaultRepository()

export function loadPages(): StoredPage[] {
  return repository.loadPages()
}

export function getPage(id: string): StoredPage | undefined {
  return repository.getPage(id)
}

export function savePage(schema: AnyPageSchema): StoredPage {
  return repository.savePage(schema)
}

export function deletePage(id: string): void {
  repository.deletePage(id)
}

export function addVersion(pageId: string, schema: AnyPageSchema): void {
  repository.addVersion(pageId, schema)
}

export function listVersions(pageId: string): PageVersion[] {
  return repository.listVersions(pageId)
}

export function rollback(pageId: string, versionId: string): AnyPageSchema | undefined {
  return repository.rollback(pageId, versionId)
}

export function listTemplates(): StoredTemplate[] {
  return repository.listTemplates()
}

export function saveTemplate(
  schema: AnyPageSchema,
  name?: string,
  description?: string,
): StoredTemplate {
  return repository.saveTemplate(schema, name, description)
}

export function deleteTemplate(id: string): void {
  repository.deleteTemplate(id)
}

export function templateToPage(template: StoredTemplate): AnyPageSchema {
  return repository.templateToPage(template)
}
