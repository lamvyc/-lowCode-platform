import { z } from 'zod'
import type { EventAction } from '../types/event'

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
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
  bindings: nodeBindingsSchema.optional(),
  events: nodeEventsSchema.optional(),
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
  })
  .passthrough()

const dataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['rest', 'static', 'localStorage', 'sessionStorage', 'pageVariable']),
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
  version: z.string(),
  meta: pageMetaSchema,
  nodes: z.array(pageNodeSchema),
  materials: z.array(materialRefSchema),
  dataSources: z.array(dataSourceSchema),
  variables: z.array(pageVariableSchema),
  rules: z.array(ruleSchema),
  routes: routeConfigSchema.optional(),
  settings: pageSettingsSchema.optional(),
})
