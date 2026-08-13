import type { PageSchema } from '../types/page'
import { pageSchemaSchema } from './schema.zod'

/** 当前协议版本号 */
export const SCHEMA_VERSION = '1.0.0'

/** 校验并返回类型安全的 PageSchema */
export function parsePageSchema(input: unknown): PageSchema {
  return pageSchemaSchema.parse(input) as PageSchema
}

/** 类型守卫：输入是否为合法 PageSchema */
export function isPageSchema(input: unknown): input is PageSchema {
  return pageSchemaSchema.safeParse(input).success
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
