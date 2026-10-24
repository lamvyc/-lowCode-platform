import type { PageNode, PageSchema } from '@lowcode/schema'
import type { MappingRegistry } from './mappings/types'
import type { CodegenWarning } from './types'

/** 生成计划：root 节点、字段节点、模型键与告警 */
export interface CodegenPlan {
  schema: PageSchema
  rootNodes: PageNode[]
  fieldNodes: PageNode[]
  modelKeys: Map<string, string>
  warnings: CodegenWarning[]
}

/** JS 保留字，避免用户把字段名起成 `class` 之类 */
const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if',
  'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this',
  'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'await',
  'enum', 'implements', 'interface', 'package', 'private', 'protected', 'public',
  'static', 'null', 'true', 'false',
])

/**
 * 把用户输入转成合法 JS 标识符：
 * - 非法字符替换为 `_`；
 * - 首字符非字母/`_`/`$` 时前置 `_`；
 * - 空串或只剩 `_` 时回退 fallback；
 * - 保留字前置 `_`（`class` → `_class`）。
 */
export function sanitizeIdentifier(raw: string, fallback: string): string {
  const trimmed = (raw ?? '').trim()
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_$]/g, '_')
  if (!cleaned || cleaned === '_') return fallback
  let identifier = /^[a-zA-Z_$]/.test(cleaned) ? cleaned : `_${cleaned}`
  if (RESERVED.has(identifier)) identifier = `_${identifier}`
  return identifier
}

/** 收集所有被 children / slots 引用的节点 id */
function collectReferenced(nodes: PageNode[]): Set<string> {
  const referenced = new Set<string>()
  for (const node of nodes) {
    for (const childId of node.children ?? []) referenced.add(childId)
    for (const ids of Object.values(node.slots ?? {})) {
      for (const id of ids) referenced.add(id)
    }
  }
  return referenced
}

/** 从 Schema 构建生成计划（不修改入参） */
export function buildPlan(schema: PageSchema, registry: MappingRegistry): CodegenPlan {
  const warnings: CodegenWarning[] = []
  const referenced = collectReferenced(schema.nodes)

  for (const node of schema.nodes) {
    if (!registry.get(node.type) && !registry.component(node.type)) {
      warnings.push({
        code: 'unknown-material',
        message: `未注册物料: ${node.type}`,
        nodeId: node.id,
      })
    }
  }

  const fieldNodes = schema.nodes.filter(
    (node) => registry.get(node.type)?.field === true,
  )

  const modelKeys = new Map<string, string>()
  const used = new Set<string>()
  fieldNodes.forEach((node, index) => {
    const idFallback = sanitizeIdentifier(node.id, `node_${index}`)
    const rawName = node.name || node.id
    let key = sanitizeIdentifier(rawName, idFallback)
    if (key !== rawName) {
      warnings.push({
        code: 'model-key',
        message: `字段名「${rawName}」不是合法标识符，已用「${key}」代替`,
        nodeId: node.id,
      })
    }
    if (used.has(key)) {
      const original = key
      let fallback = idFallback
      let suffix = 2
      while (used.has(fallback)) {
        fallback = `${idFallback}_${suffix}`
        suffix += 1
      }
      key = fallback
      warnings.push({
        code: 'model-key',
        message: `字段名「${original}」重复，节点 ${node.id} 改用「${key}」`,
        nodeId: node.id,
      })
    }
    used.add(key)
    modelKeys.set(node.id, key)
  })

  return {
    schema,
    rootNodes: schema.nodes.filter((node) => !referenced.has(node.id)),
    fieldNodes,
    modelKeys,
    warnings,
  }
}
