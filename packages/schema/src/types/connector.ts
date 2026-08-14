import type { ApiAuthType, HttpMethod } from './api'

/** 连接器认证配置（bearer → Authorization 头，apiKey → X-Api-Key 头） */
export interface ConnectorAuth {
  type: ApiAuthType
  /** 注入的 header 名（缺省：bearer → Authorization，apiKey → X-Api-Key） */
  header?: string
  /** 值前缀（缺省：bearer → "Bearer "） */
  prefix?: string
  /** 认证配置项 JSON Schema（用于生成配置表单） */
  configSchema?: Record<string, unknown>
}

/** 连接器动作：一个可调用的 HTTP 端点 */
export interface ConnectorAction {
  name: string
  label?: string
  method: HttpMethod
  /** 相对 baseUrl 的路径 */
  path: string
  /** 请求参数 JSON Schema（用于生成参数表单） */
  requestSchema?: Record<string, unknown>
}

/**
 * 连接器：外部系统的声明式接入（如企业微信 / SAP / 第三方 API）。
 * 由 ConnectorRegistry 消费，按 baseUrl + path + auth 组装请求。
 */
export interface ConnectorDefinition {
  name: string
  label?: string
  description?: string
  baseUrl?: string
  auth?: ConnectorAuth
  actions: ConnectorAction[]
}
