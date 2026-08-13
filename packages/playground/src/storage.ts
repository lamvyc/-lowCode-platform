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

const PAGES_KEY = 'lc.pages'
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
