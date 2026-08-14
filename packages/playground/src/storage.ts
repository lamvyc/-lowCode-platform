import { MemoryStorage } from '@lowcode/core'
import { parsePageSchema, type PageSchema } from '@lowcode/schema'

export interface StoredPage {
  id: string
  name: string
  updatedAt: string
  schema: PageSchema
}

export interface PageVersion {
  id: string
  at: string
  schema: PageSchema
}

export interface StoredTemplate {
  id: string
  name: string
  description?: string
  createdAt: string
  schema: PageSchema
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
          schema: parsePageSchema(item.schema),
        }]
      } catch {
        return []
      }
    })
  }

  getPage(id: string): StoredPage | undefined {
    return this.loadPages().find((page) => page.id === id)
  }

  savePage(schema: PageSchema): StoredPage {
    const validSchema = parsePageSchema(schema)
    const pages = this.loadPages()
    const now = new Date().toISOString()
    const stored: StoredPage = {
      id: validSchema.meta.id,
      name: validSchema.meta.name,
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

  addVersion(pageId: string, schema: PageSchema): void {
    const validSchema = parsePageSchema(schema)
    const versions = this.listVersions(pageId)
    versions.unshift({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      schema: validSchema,
    })
    this.writeJson(`${VERSION_PREFIX}${pageId}`, versions.slice(0, MAX_VERSIONS))
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
        return [{ id: item.id, at: item.at, schema: parsePageSchema(item.schema) }]
      } catch {
        return []
      }
    })
  }

  rollback(pageId: string, versionId: string): PageSchema | undefined {
    const version = this.listVersions(pageId).find((item) => item.id === versionId)
    return version ? (JSON.parse(JSON.stringify(version.schema)) as PageSchema) : undefined
  }

  listTemplates(): StoredTemplate[] {
    const items = this.readJson<unknown[]>(TEMPLATES_KEY, [])
    if (!Array.isArray(items)) return []
    return items.flatMap((item) => {
      if (!isStoredTemplate(item)) return []
      try {
        return [{
          ...item,
          schema: parsePageSchema(item.schema),
        }]
      } catch {
        return []
      }
    })
  }

  saveTemplate(
    schema: PageSchema,
    name?: string,
    description?: string,
  ): StoredTemplate {
    const validSchema = parsePageSchema(schema)
    const templates = this.listTemplates()
    const template: StoredTemplate = {
      id: `template_${Date.now().toString(36)}`,
      name: name ?? `${validSchema.meta.name}模板`,
      description,
      createdAt: new Date().toISOString(),
      schema: JSON.parse(JSON.stringify(validSchema)) as PageSchema,
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

  templateToPage(template: StoredTemplate): PageSchema {
    const schema = JSON.parse(JSON.stringify(template.schema)) as PageSchema
    const now = new Date().toISOString()
    schema.meta = {
      ...schema.meta,
      id: `page_${Date.now().toString(36)}`,
      name: `${template.name} 副本`,
      createdAt: now,
      updatedAt: now,
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

export function savePage(schema: PageSchema): StoredPage {
  return repository.savePage(schema)
}

export function deletePage(id: string): void {
  repository.deletePage(id)
}

export function addVersion(pageId: string, schema: PageSchema): void {
  repository.addVersion(pageId, schema)
}

export function listVersions(pageId: string): PageVersion[] {
  return repository.listVersions(pageId)
}

export function rollback(pageId: string, versionId: string): PageSchema | undefined {
  return repository.rollback(pageId, versionId)
}

export function listTemplates(): StoredTemplate[] {
  return repository.listTemplates()
}

export function saveTemplate(
  schema: PageSchema,
  name?: string,
  description?: string,
): StoredTemplate {
  return repository.saveTemplate(schema, name, description)
}

export function deleteTemplate(id: string): void {
  repository.deleteTemplate(id)
}

export function templateToPage(template: StoredTemplate): PageSchema {
  return repository.templateToPage(template)
}
