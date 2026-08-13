import type { PageSchema } from '../types/page'
import { parsePageSchema } from '../validation/validate'

/** 序列化页面为 JSON 字符串 */
export function serializePage(schema: PageSchema, pretty = true): string {
  return JSON.stringify(schema, null, pretty ? 2 : 0)
}

/** 从 JSON 字符串反序列化并校验 */
export function deserializePage(json: string): PageSchema {
  return parsePageSchema(JSON.parse(json))
}

/** 深拷贝 schema（用于撤销/快照等场景） */
export function cloneSchema<T extends PageSchema>(schema: T): T {
  return JSON.parse(JSON.stringify(schema)) as T
}
