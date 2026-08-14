import type { ConnectorAuth, ConnectorDefinition } from '@lowcode/schema'
import type { HttpClient, HttpRequestConfig } from '../datasource/manager'

/** 凭证提供器：按连接器名 + 认证类型取凭证（token / apiKey） */
export type ConnectorCredentialProvider = (
  connectorName: string,
  authType: string,
) => string | undefined

export interface ConnectorInvokeOptions {
  http: HttpClient
  getCredential?: ConnectorCredentialProvider
}

/**
 * 连接器注册表：注册外部系统连接器，按声明组装 HTTP 请求并调用注入的 HttpClient。
 * 连接器动作通过 registerConnectorActions 注册进 ActionRegistry 后即可被动作链调用。
 */
export class ConnectorRegistry {
  private connectors = new Map<string, ConnectorDefinition>()

  register(connector: ConnectorDefinition): void {
    if (this.connectors.has(connector.name)) {
      throw new Error(`连接器已注册: ${connector.name}`)
    }
    this.connectors.set(connector.name, connector)
  }

  registerMany(connectors: ConnectorDefinition[]): void {
    for (const connector of connectors) this.register(connector)
  }

  get(name: string): ConnectorDefinition | undefined {
    return this.connectors.get(name)
  }

  has(name: string): boolean {
    return this.connectors.has(name)
  }

  list(): ConnectorDefinition[] {
    return [...this.connectors.values()]
  }

  /** 执行连接器动作：GET/DELETE 用 query 参数，其余用 body */
  async invoke(
    connectorName: string,
    actionName: string,
    params: Record<string, unknown> = {},
    options: ConnectorInvokeOptions,
  ): Promise<unknown> {
    const connector = this.get(connectorName)
    if (!connector) throw new Error(`连接器未注册: ${connectorName}`)
    const action = connector.actions.find((a) => a.name === actionName)
    if (!action) throw new Error(`连接器动作不存在: ${connectorName}.${actionName}`)

    const request: HttpRequestConfig = {
      url: `${connector.baseUrl ?? ''}${action.path}`,
      method: action.method,
      headers: buildAuthHeaders(connector.auth, connectorName, options),
    }
    if (action.method === 'GET' || action.method === 'DELETE') {
      request.params = params
    } else {
      request.body = params
    }
    return options.http.request(request)
  }
}

function buildAuthHeaders(
  auth: ConnectorAuth | undefined,
  connectorName: string,
  options: ConnectorInvokeOptions,
): Record<string, string> {
  if (!auth || auth.type === 'none') return {}
  const credential = options.getCredential?.(connectorName, auth.type)
  if (!credential) return {}
  const header = auth.header ?? (auth.type === 'bearer' ? 'Authorization' : 'X-Api-Key')
  const prefix = auth.prefix ?? (auth.type === 'bearer' ? 'Bearer ' : '')
  return { [header]: `${prefix}${credential}` }
}
