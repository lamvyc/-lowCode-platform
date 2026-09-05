export { DataBus, type BusListener } from './data-bus'
export {
  NodeTree,
  type MoveOptions,
  type MoveCheckResult,
} from './node-tree'
export {
  MaterialRegistry,
  NodeFactory,
  createNodeId,
  createUniqueName,
} from './material/registry'
export {
  JexlExpressionEngine,
  FunctionRegistryImpl,
  type IExpressionEngine,
  type ExpressionContext,
  type ExpressionResult,
  type FunctionRegistry,
} from './expression/engine'
export {
  DragDropManager,
  type DragPayload,
  type DropTarget,
  type DropPosition,
  type Rect,
  type DropValidationResult,
} from './drag-drop/manager'
export {
  ActionRegistry,
  type Action,
} from './action/registry'
export {
  ActionChainRunner,
} from './action/chain'
export {
  UnifiedActionRunner,
} from './action/unified'
export {
  createBuiltinActions,
} from './action/builtin'
export {
  levenshteinDistance,
  suggestActionType,
  collectActionCandidates,
  formatActionSuggestion,
} from './action/suggest'
export type {
  ActionContext,
  ActionResult,
  ActionChainControl,
} from './action/context'
export {
  EventEngine,
  type IEventEngine,
} from './event/engine'
export {
  DataSourceManager,
  MemoryStorage,
  type HttpClient,
  type HttpRequestConfig,
  type StorageLike,
  type DataSourceState,
  type DataSourceManagerOptions,
} from './datasource/manager'
export {
  RuleEngine,
  type RuleEngineOptions,
  type RuleRunResult,
} from './rule/engine'
export {
  HistoryManager,
  type HistoryEntry,
  type HistoryOptions,
} from './history/manager'
export {
  HookBus,
  type PluginHookName,
  type HookHandler,
} from './plugin/hooks'
export {
  PluginManager,
  createPluginAPI,
  type Plugin,
  type PluginAPI,
} from './plugin/manager'
export {
  findDropPosition,
  compactLayout,
  isOverlap,
  type GridConfig,
} from './layout/grid'
export {
  RemoteMaterialLoader,
  type RemoteMaterialLoaderOptions,
  type RemoteLoadResult,
} from './remote-material/loader'
export {
  SchemaRegistry,
  type SchemaRefResolver,
} from './schema-registry/registry'
export {
  FormEngine,
  type FormEngineOptions,
} from './form/engine'
export {
  dataModelToFormSchema,
} from './form/schema'
export type {
  FormField,
  FormSchema,
  FormStatus,
} from './form/types'
export {
  ProcessEngine,
  type ProcessEngineOptions,
} from './process/engine'
export type {
  ProcessStatus,
  ProcessSnapshot,
} from './process/types'
export {
  ConnectorRegistry,
  type ConnectorInvokeOptions,
  type ConnectorCredentialProvider,
} from './connector/registry'
export {
  registerConnectorActions,
  type RegisterConnectorActionsOptions,
} from './connector/actions'
export type {
  ConnectorAuth,
  ConnectorAction,
  ConnectorDefinition,
} from '@lowcode/schema'
export {
  PermissionService,
  evaluateTableAccess,
  evaluateOperations,
  canOperation,
  evaluateFieldAccess,
  type TablePermissionAction,
  type FieldPermissionAction,
} from './permission/service'
export type { UserContext } from './permission/types'
export type { AuthProvider } from './auth/provider'
export {
  HttpError,
  isUnauthorizedError,
  authenticatedHttpClient,
  type AuthenticatedHttpClientOptions,
} from './auth/http-client'

/** 便捷类型再导出：让使用方只依赖 @lowcode/core */
export type {
  ActionKind,
  Binding,
  DataSource,
  DataSourceType,
  EventAction,
  EventDispatchPayload,
  LayoutPosition,
  Material,
  MaterialRef,
  NodeBindings,
  NodeEvents,
  NodeMeta,
  PageNode,
  PageSchema,
  PageVariable,
  PropConfig,
  PropOption,
  RemoteMaterialManifest,
  Rule,
  RuleTrigger,
  StyleConfig,
} from '@lowcode/schema'
