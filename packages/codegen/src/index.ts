export {
  VueSfcGenerator,
  generateVueSfc,
  rewriteExpression,
  type ICodeGenerator,
  type GeneratedCode,
  type CodegenMaterialMap,
  type CodegenMaterialMapEntry,
  type VueSfcGeneratorOptions,
} from './generator'
export { createDefaultRegistry } from './mappings'
export type {
  ElementMapping,
  MappingContext,
  MappingRegistry,
} from './mappings/types'
export type { CodegenWarning, ResolvedForm } from './types'
export { buildPlan, sanitizeIdentifier } from './plan'
export {
  el,
  text,
  comment,
  attr,
  bind,
  on,
  directive,
  stringifyTemplate,
  type TemplateNode,
} from './ast'
