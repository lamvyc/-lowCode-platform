import type { ActionRegistry } from '../action/registry'
import type { HttpClient } from '../datasource/manager'
import type { ConnectorCredentialProvider, ConnectorRegistry } from './registry'

export interface RegisterConnectorActionsOptions {
  registry: ConnectorRegistry
  actionRegistry: ActionRegistry
  http: HttpClient
  getCredential?: ConnectorCredentialProvider
}

/**
 * 把每个连接器动作注册为 ActionRegistry 中的自定义动作（kind = `connectorName.actionName`）。
 * 之后可通过 UnifiedActionRunner（type 自定义字符串）或旧版 custom 动作调用。
 */
export function registerConnectorActions(options: RegisterConnectorActionsOptions): void {
  for (const connector of options.registry.list()) {
    for (const action of connector.actions) {
      const kind = `${connector.name}.${action.name}`
      options.actionRegistry.register({
        kind,
        label: action.label ?? `${connector.label ?? connector.name} · ${action.name}`,
        execute: async (_ctx, config) => {
          try {
            const value = await options.registry.invoke(
              connector.name,
              action.name,
              config as Record<string, unknown>,
              { http: options.http, getCredential: options.getCredential },
            )
            return { ok: true, value }
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) }
          }
        },
      })
    }
  }
}
