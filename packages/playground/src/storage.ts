import type { PageSchema } from '@lowcode/schema'

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

const PAGES_KEY = 'lc.pages'
const TEMPLATES_KEY = 'lc.templates'
const VERSION_PREFIX = 'lc.versions.'
const MAX_VERSIONS = 20

export function loadPages(): StoredPage[] {
  try {
    const raw = localStorage.getItem(PAGES_KEY)
    return raw ? (JSON.parse(raw) as StoredPage[]) : []
  } catch {
    return []
  }
}

function persistPages(pages: StoredPage[]): void {
  localStorage.setItem(PAGES_KEY, JSON.stringify(pages))
}

export function getPage(id: string): StoredPage | undefined {
  return loadPages().find((page) => page.id === id)
}

export function savePage(schema: PageSchema): StoredPage {
  const pages = loadPages()
  const now = new Date().toISOString()
  const existing = pages.find((page) => page.id === schema.meta.id)
  const stored: StoredPage = {
    id: schema.meta.id,
    name: schema.meta.name,
    updatedAt: now,
    schema,
  }
  if (existing) {
    Object.assign(existing, stored)
  } else {
    pages.push(stored)
  }
  persistPages(pages)
  return stored
}

export function deletePage(id: string): void {
  persistPages(loadPages().filter((page) => page.id !== id))
  localStorage.removeItem(`${VERSION_PREFIX}${id}`)
}

export function addVersion(pageId: string, schema: PageSchema): void {
  const versions = listVersions(pageId)
  versions.unshift({ id: `${Date.now().toString(36)}`, at: new Date().toISOString(), schema })
  localStorage.setItem(
    `${VERSION_PREFIX}${pageId}`,
    JSON.stringify(versions.slice(0, MAX_VERSIONS)),
  )
}

export function listVersions(pageId: string): PageVersion[] {
  try {
    const raw = localStorage.getItem(`${VERSION_PREFIX}${pageId}`)
    return raw ? (JSON.parse(raw) as PageVersion[]) : []
  } catch {
    return []
  }
}

export function rollback(pageId: string, versionId: string): PageSchema | undefined {
  const version = listVersions(pageId).find((item) => item.id === versionId)
  return version ? (JSON.parse(JSON.stringify(version.schema)) as PageSchema) : undefined
}

export function listTemplates(): StoredTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    return raw ? (JSON.parse(raw) as StoredTemplate[]) : []
  } catch {
    return []
  }
}

export function saveTemplate(
  schema: PageSchema,
  name?: string,
  description?: string,
): StoredTemplate {
  const templates = listTemplates()
  const template: StoredTemplate = {
    id: `template_${Date.now().toString(36)}`,
    name: name ?? `${schema.meta.name}模板`,
    description,
    createdAt: new Date().toISOString(),
    schema: JSON.parse(JSON.stringify(schema)) as PageSchema,
  }
  templates.unshift(template)
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
  return template
}

export function deleteTemplate(id: string): void {
  localStorage.setItem(
    TEMPLATES_KEY,
    JSON.stringify(listTemplates().filter((template) => template.id !== id)),
  )
}

/** 模板 → 新页面（复制 schema 并换新 id / 名称） */
export function templateToPage(template: StoredTemplate): PageSchema {
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
