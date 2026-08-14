import { unifiedEventToLegacy } from './types/action'
import type { DataSource } from './types/datasource'
import type { PageSchema } from './types/page'
import type { PageSpec, UnifiedDataSource, UnifiedPageSchema } from './types/pageSpec'
import { isSchemaEnvelope, parsePageSchema } from './validation/validate'

/** 页面 Schema 输入：旧版扁平或统一结构 */
export type AnyPageSchema = PageSchema | UnifiedPageSchema

/** 统一数据源 → 旧版数据源（渲染/编辑兼容视图） */
function toLegacyDataSource(source: UnifiedDataSource): DataSource {
  const name = source.name ?? source.id
  switch (source.type) {
    case 'static':
      return {
        id: source.id,
        name,
        type: 'static',
        config: { staticData: source.value },
      }
    case 'localStorage':
    case 'sessionStorage':
      return {
        id: source.id,
        name,
        type: source.type,
        config: { storageKey: source.storageKey },
      }
    case 'pageVariable':
      return {
        id: source.id,
        name,
        type: 'pageVariable',
        config: { variableId: source.variableId },
      }
    case 'API':
      return {
        id: source.id,
        name,
        type: 'API',
        config: {
          apiRef: source.ref,
          params: source.params,
          pollInterval: source.pollInterval,
        },
      }
    case 'DataModel':
      return {
        id: source.id,
        name,
        type: 'DataModel',
        config: {
          modelRef: source.ref,
          operation: source.operation,
          filter: source.filter,
        },
      }
  }
}

/**
 * 页面 Schema 归一化：统一 Page（2.x）→ 旧版扁平视图（供 NodeTree / EventEngine /
 * Renderer 等既有引擎消费）。旧版输入原样校验返回（P5 兼容）。
 *
 * 注意：DataModel / API 数据源以 ref 形式保留在 config.params 中，
 * 实际取数语义由统一 DataSourceManager（DataModel/API ref 解析器）执行。
 */
export function normalizePageSchema(input: AnyPageSchema): PageSchema {
  if (!isSchemaEnvelope(input)) {
    return parsePageSchema(input)
  }

  const unified = input as UnifiedPageSchema
  const spec: PageSpec = unified.spec
  const legacy: PageSchema = {
    version: unified.version,
    meta: {
      id: unified.metadata.id,
      name: unified.metadata.name,
      description: unified.metadata.description,
      route: spec.route,
      createdAt: unified.metadata.createdAt,
      updatedAt: unified.metadata.updatedAt,
    },
    nodes: spec.nodes.map((node) => ({
      ...node,
      events: node.events
        ? Object.fromEntries(
            Object.entries(node.events).map(([eventName, actions]) => [
              eventName,
              actions.map(unifiedEventToLegacy),
            ]),
          )
        : undefined,
    })),
    materials: spec.materials ?? [],
    dataSources: (spec.dataSources ?? []).map(toLegacyDataSource),
    variables: spec.variables ?? [],
    rules: (spec.interactions ?? []).map((interaction) => ({
      id: interaction.id,
      name: interaction.name ?? interaction.id,
      enabled: interaction.enabled ?? true,
      trigger: interaction.trigger ?? 'expression',
      condition: interaction.expression,
      actions: interaction.actions.map(unifiedEventToLegacy),
      debounceMs: interaction.debounceMs,
      dependsOn: interaction.dependsOn,
    })),
    settings: spec.settings,
  }
  return parsePageSchema(legacy)
}
