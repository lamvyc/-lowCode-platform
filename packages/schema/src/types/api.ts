import type { FieldType } from './datamodel'
import type { SchemaEnvelope } from './schema'

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export const API_AUTH_TYPES = ['none', 'bearer', 'apiKey', 'oauth2'] as const
export type ApiAuthType = (typeof API_AUTH_TYPES)[number]

export interface ApiParameter {
  type: FieldType
  required?: boolean
  description?: string
  defaultValue?: unknown
}

/**
 * API 声明：只描述端点 / 入参 / 出参契约（P6 关注点分离）
 * 数据处理逻辑由 Process 层编排，API Schema 不做计算。
 */
export interface ApiSpec {
  endpoint: string
  method: HttpMethod
  request?: {
    params?: Record<string, ApiParameter>
    query?: Record<string, ApiParameter>
    headers?: Record<string, string>
    /** body 结构（JSON Schema 或 DataModel 引用） */
    body?: Record<string, unknown>
  }
  response?: {
    status?: number
    /** 响应结构（JSON Schema） */
    schema?: Record<string, unknown>
  }
  auth?: ApiAuthType
  timeoutMs?: number
}

export interface ApiSchema extends SchemaEnvelope<'API', ApiSpec> {}
