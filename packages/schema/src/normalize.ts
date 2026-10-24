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
 * 节点级兼容归一化（不提升版本）：
 * - 历史数据把数据表格写成 `table`（携带 columns/data）；runtime 的布局表格会忽略它们，
 *   在 codegen 之前统一改回 `data-table`，让画布、预览、生成三处看到同一语义。
 * - 旧按钮只写 `text`；编辑器补默认 `label` 时会把 text 遮掉，这里先补 label。
 */
function applyNodeCompat(schema: PageSchema): PageSchema {
  for (const node of schema.nodes) {
    if (
      node.type === 'table' &&
      (node.props?.columns !== undefined || node.props?.data !== undefined)
    ) {
      node.type = 'data-table'
    }
    if (
      node.type === 'button' &&
      (node.props?.label === undefined || node.props?.label === '') &&
      node.props?.text !== undefined
    ) {
      node.props.label = node.props.text
    }
  }
  return schema
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
    return applyNodeCompat(parsePageSchema(input))
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
  return applyNodeCompat(parsePageSchema(legacy))
}
