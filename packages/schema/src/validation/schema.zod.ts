import { z } from 'zod'
import {
  API_AUTH_TYPES,
  HTTP_METHODS,
} from '../types/api'
import {
  CRUD_ACTIONS,
  FIELD_PERMISSION_ACTIONS,
  FIELD_TYPES,
  RELATION_TYPES,
  TABLE_PERMISSION_ACTIONS,
} from '../types/datamodel'
import {
  DATA_SOURCE_OPERATIONS,
  INTERACTION_TRIGGERS,
} from '../types/pageSpec'
import { DATA_MODEL_OPERATIONS, PROCESS_NODE_TYPES } from '../types/process'
import { validateExpression, validatePageSpecExpressions } from '../types/expression'
import type { EventAction } from '../types/event'

/** 语义化版本号：major.minor.patch（P5） */
export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, '版本号必须符合语义化版本规范 major.minor.patch')

/** 泛型绑定校验器：静态值类型由调用方指定 */
function makeBindingSchema<T>(valueSchema: z.ZodType<T>) {
  return z.union([
    z.object({
      type: z.literal('static'),
      value: valueSchema,
    }),
    z.object({
      type: z.literal('expression'),
      value: z.string(),
    }),
  ])
}

const loopConfigSchema = z.object({
  source: z.string(),
  itemName: z.string(),
  indexName: z.string().optional(),
})

const visibleBindingSchema = makeBindingSchema(z.boolean())
const loopBindingSchema = makeBindingSchema(loopConfigSchema)
const styleBindingSchema = makeBindingSchema(z.union([z.string(), z.number()]))

const nodeBindingsSchema = z
  .object({
    visible: visibleBindingSchema.optional(),
    loop: loopBindingSchema.optional(),
  })
  .passthrough()

const eventActionSchema: z.ZodType<EventAction> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.enum([
      'setProp',
      'setVariable',
      'openDialog',
      'closeDialog',
      'emitEvent',
      'request',
      'navigate',
      'custom',
    ]),
    label: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    when: z.string().optional(),
    children: z.array(eventActionSchema).optional(),
    catch: z.array(eventActionSchema).optional(),
    continueOnError: z.boolean().optional(),
    delay: z.number().optional(),
  }),
)

const nodeEventsSchema = z.record(z.string(), z.array(eventActionSchema))

const styleConfigSchema = z.record(z.string(), styleBindingSchema)

const nodeMetaSchema = z
  .object({
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    label: z.string().optional(),
  })
  .passthrough()

export const pageNodeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
  bindings: nodeBindingsSchema.optional(),
  events: nodeEventsSchema.optional(),
  style: styleConfigSchema.optional(),
  meta: nodeMetaSchema.optional(),
})

/**
 * 统一事件动作（P1）：type 为标准 ActionType 或插件自定义字符串。
 * 标准类型由 TypeScript 枚举提供 IDE 自动补全；运行时校验放宽为任意非空字符串，
 * 以允许插件注册的自定义动作类型（防呆由设计器在编辑态对标准枚举做提示）。
 */
const unifiedEventActionSchema = z.object({
  id: z.string(),
  type: z.string().min(1, '动作类型不能为空'),
  label: z.string().optional(),
  target: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  expression: z.string().optional(),
})

const unifiedNodeEventsSchema = z.record(z.string(), z.array(unifiedEventActionSchema))

/** 统一页面节点：事件使用标准 Action */
const unifiedPageNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
  bindings: nodeBindingsSchema.optional(),
  events: unifiedNodeEventsSchema.optional(),
  style: styleConfigSchema.optional(),
  meta: nodeMetaSchema.optional(),
})

const materialRefSchema = z.object({
  type: z.string(),
  version: z.string().optional(),
})

const dataSourceConfigSchema = z
  .object({
    url: z.string().optional(),
    method: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    staticData: z.unknown().optional(),
    storageKey: z.string().optional(),
    variableId: z.string().optional(),
    pollInterval: z.number().optional(),
    modelRef: z.string().optional(),
    operation: z.enum(DATA_MODEL_OPERATIONS).optional(),
    filter: z.string().optional(),
    apiRef: z.string().optional(),
  })
  .passthrough()

const dataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'rest',
    'static',
    'localStorage',
    'sessionStorage',
    'pageVariable',
    'DataModel',
    'API',
  ]),
  config: dataSourceConfigSchema,
  autoLoad: z.boolean().optional(),
  enabled: z.boolean().optional(),
})

const pageVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.unknown(),
  persistent: z.boolean().optional(),
})

const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  trigger: z.enum(['expression', 'event', 'datasource', 'mount']),
  condition: z.string(),
  actions: z.array(eventActionSchema),
  debounceMs: z.number().optional(),
  dependsOn: z.array(z.string()).optional(),
})

const pageMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  route: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const layoutSchema = z.object({
  mode: z.enum(['free', 'grid']),
  grid: z
    .object({
      columns: z.number(),
      rowHeight: z.number(),
      margin: z.number(),
    })
    .optional(),
})

const pageSettingsSchema = z
  .object({
    title: z.string().optional(),
    layout: layoutSchema.optional(),
    backgroundColor: z.string().optional(),
    width: z.number().optional(),
  })
  .passthrough()

const routeConfigSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

/** PageSchema 的 Zod 校验器 */
export const pageSchemaSchema = z.object({
  version: semverSchema,
  meta: pageMetaSchema,
  nodes: z.array(pageNodeSchema),
  materials: z.array(materialRefSchema),
  dataSources: z.array(dataSourceSchema),
  variables: z.array(pageVariableSchema),
  rules: z.array(ruleSchema),
  routes: routeConfigSchema.optional(),
  settings: pageSettingsSchema.optional(),
})

// ---------------------------------------------------------------------------
// 统一五层 Schema（P5 骨架：version / kind / metadata / spec / migrations）
// ---------------------------------------------------------------------------

const schemaMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const schemaChangeSchema = z.object({
  field: z.string(),
  deprecated: z.boolean().optional(),
  alternative: z.string().optional(),
  reason: z.string().optional(),
})

const schemaMigrationSchema = z.object({
  from: z.string(),
  to: z.string(),
  changes: z.array(schemaChangeSchema),
})

// --- DataModel（P2：字段 / 关联 / 三级权限） ---

const fieldValidationSchema = z
  .object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    custom: z.string().optional(),
  })
  .passthrough()

const dataModelFieldSchema = z
  .object({
    name: z.string(),
    type: z.enum(FIELD_TYPES),
    label: z.string().optional(),
    description: z.string().optional(),
    unique: z.boolean().optional(),
    defaultValue: z.unknown().optional(),
    validation: fieldValidationSchema.optional(),
    expression: z.string().optional(),
  })
  .refine(
    (field) => !field.expression || validateExpression(field.expression, 'DataModel').ok,
    { message: '计算字段表达式违反沙箱规范（DataModel 上下文: $record/$context/$user）' },
  )

const dataModelRelationSchema = z.object({
  name: z.string(),
  type: z.enum(RELATION_TYPES),
  ref: z.string(),
  foreignKey: z.string().optional(),
  through: z.string().optional(),
  cascade: z.enum(['none', 'restrict', 'cascade', 'setNull']).optional(),
})

const dataModelPermissionsSchema = z.object({
  table: z
    .array(z.object({ role: z.string(), action: z.enum(TABLE_PERMISSION_ACTIONS) }))
    .optional(),
  field: z
    .array(
      z.object({
        fieldName: z.string(),
        role: z.string(),
        action: z.enum(FIELD_PERMISSION_ACTIONS),
      }),
    )
    .optional(),
  operation: z
    .array(z.object({ role: z.string(), actions: z.array(z.enum(CRUD_ACTIONS)) }))
    .optional(),
})

const dataModelSpecSchema = z.object({
  primaryKey: z.string().optional(),
  collection: z.string().optional(),
  fields: z.array(dataModelFieldSchema),
  relations: z.array(dataModelRelationSchema).optional(),
  permissions: dataModelPermissionsSchema.optional(),
})

// --- Process（P1/P6：声明式节点与边） ---

const processVariableSchema = z.object({
  name: z.string(),
  type: z.enum(FIELD_TYPES),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
})

const processNodeSchema = z
  .object({
    id: z.string(),
    type: z.enum(PROCESS_NODE_TYPES),
    name: z.string().optional(),
    expression: z.string().optional(),
    apiRef: z.string().optional(),
    modelRef: z.string().optional(),
    operation: z.enum(DATA_MODEL_OPERATIONS).optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    output: z.string().optional(),
    delayMs: z.number().optional(),
  })
  .refine(
    (node) => !node.expression || validateExpression(node.expression, 'Process').ok,
    { message: '流程节点表达式违反沙箱规范（Process 上下文: $input/$context/$output/$node）' },
  )

const processEdgeSchema = z
  .object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    expression: z.string().optional(),
  })
  .refine(
    (edge) => !edge.expression || validateExpression(edge.expression, 'Process').ok,
    { message: '流程分支表达式违反沙箱规范' },
  )

const processSpecSchema = z.object({
  input: z.array(processVariableSchema).optional(),
  output: z.array(processVariableSchema).optional(),
  variables: z.array(processVariableSchema).optional(),
  nodes: z.array(processNodeSchema),
  edges: z.array(processEdgeSchema),
})

// --- API（P6：只声明端点契约，不含处理逻辑） ---

const apiParameterSchema = z.object({
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  description: z.string().optional(),
  defaultValue: z.unknown().optional(),
})

const apiSpecSchema = z.object({
  endpoint: z.string(),
  method: z.enum(HTTP_METHODS),
  request: z
    .object({
      params: z.record(z.string(), apiParameterSchema).optional(),
      query: z.record(z.string(), apiParameterSchema).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  response: z
    .object({
      status: z.number().optional(),
      schema: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  auth: z.enum(API_AUTH_TYPES).optional(),
  timeoutMs: z.number().optional(),
})

// --- Plugin（P4：JSON Schema 属性面板 + 插件接口） ---

const pluginComponentDeclarationSchema = z.object({
  identifier: z.string(),
  propertySchema: z.record(z.string(), z.unknown()),
  pluginInterface: z.string().optional(),
  category: z.string().optional(),
  slots: z.array(z.string()).optional(),
  remote: z.record(z.string(), z.unknown()).optional(),
})

const pluginSpecSchema = z.object({
  componentRegistry: z
    .object({
      builtin: z.array(z.string()).optional(),
      custom: z.array(pluginComponentDeclarationSchema).optional(),
    })
    .optional(),
  actionTypes: z.array(z.string()).optional(),
  expressionFunctions: z
    .array(z.object({ name: z.string(), description: z.string().optional() }))
    .optional(),
  entry: z.string().optional(),
})

// --- Page（P1/P2/P6：引用外部数据源 + 标准动作 + 声明式交互） ---

const unifiedDataSourceSchema = z.union([
  z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.literal('DataModel'),
    ref: z.string(),
    operation: z.enum(DATA_SOURCE_OPERATIONS),
    filter: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.literal('API'),
    ref: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
    pollInterval: z.number().optional(),
  }),
  z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.enum(['static', 'localStorage', 'sessionStorage', 'pageVariable']),
    value: z.unknown().optional(),
    storageKey: z.string().optional(),
    variableId: z.string().optional(),
  }),
])

const unifiedInteractionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  trigger: z.enum(INTERACTION_TRIGGERS).optional(),
  expression: z.string(),
  actions: z.array(unifiedEventActionSchema),
  debounceMs: z.number().optional(),
  dependsOn: z.array(z.string()).optional(),
})

const pageSpecSchema = z.object({
  route: z.string().optional(),
  nodes: z.array(unifiedPageNodeSchema),
  materials: z.array(materialRefSchema).optional(),
  dataSources: z.array(unifiedDataSourceSchema).optional(),
  variables: z.array(pageVariableSchema).optional(),
  interactions: z.array(unifiedInteractionSchema).optional(),
  settings: pageSettingsSchema.optional(),
})

// --- 统一信封：按 kind 分发（P5） ---

const envelopeBase = {
  version: semverSchema,
  metadata: schemaMetadataSchema,
  migrations: z.array(schemaMigrationSchema).optional(),
}

export const schemaEnvelopeSchema = z
  .union([
    z.object({ ...envelopeBase, kind: z.literal('Page'), spec: pageSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('DataModel'), spec: dataModelSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('Process'), spec: processSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('API'), spec: apiSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('Plugin'), spec: pluginSpecSchema }),
  ])
  .superRefine((envelope, ctx) => {
    if (envelope.kind !== 'Page') return
    const result = validatePageSpecExpressions(envelope.spec)
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `页面表达式违反沙箱规范: ${result.errors.join('; ')}`,
      })
    }
  })
