import prettier from 'prettier'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { isExpressionBinding, isStaticBinding } from '@lowcode/schema'
import { attr, bind, directive, el, on, stringifyTemplate, type TemplateNode } from './ast'

/** 代码生成器接口：未来可扩展 React / HTML */
export interface ICodeGenerator {
  generate(schema: PageSchema): Promise<GeneratedCode>
}

export interface GeneratedCode {
  filename: string
  code: string
  template: string
  script: string
  style: string
}

function pascalCase(type: string): string {
  return type
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function camelCase(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_$]/g, '_')
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1).replace(/[-_]([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
}

/**
 * 表达式重写：把低代码表达式映射为生成代码中的响应式标识符。
 * - $datasource.<id>.data → <id 的驼峰 ref>（模板中自动解包）
 * - $page.<name> → <name>
 */
export function rewriteExpression(expr: string, datasourceIds: string[], variableNames: string[]): string {
  let result = expr
  for (const id of datasourceIds) {
    result = result.replaceAll(`$datasource.${id}.data`, camelCase(id))
    result = result.replaceAll(`$datasource.${id}`, `${camelCase(id)}State`)
  }
  for (const name of variableNames) {
    result = result.replaceAll(`$page.${name}`, name)
  }
  return result
}

function resolvePropBinding(node: PageNode, propName: string): unknown {
  const raw = node.props[propName]
  if (isExpressionBinding(raw)) return { expression: raw.value }
  if (isStaticBinding(raw)) return raw.value
  return raw
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** 把节点转成模板 AST */
function nodeToAst(
  node: PageNode,
  ctx: { datasourceIds: string[]; variableNames: string[]; allNodes: PageNode[] },
): TemplateNode {
  const tag = `Lc${pascalCase(node.type)}`
  const attrs: Record<string, string> = {}

  // 静态 / 表达式属性
  for (const propName of Object.keys(node.props)) {
    const value = resolvePropBinding(node, propName)
    if (value && typeof value === 'object' && 'expression' in value) {
      const rewritten = rewriteExpression(
        String((value as { expression: string }).expression),
        ctx.datasourceIds,
        ctx.variableNames,
      )
      attrs[bind(propName)] = rewritten
    } else if (typeof value === 'string') {
      attrs[attr(propName)] = value
    } else if (value !== undefined && value !== null) {
      attrs[bind(propName)] = toJson(value)
    }
  }

  // visible → v-if
  const visible = node.bindings?.visible
  if (visible) {
    const expr = isExpressionBinding(visible)
      ? rewriteExpression(visible.value, ctx.datasourceIds, ctx.variableNames)
      : toJson(Boolean(visible.value))
    attrs[directive('v-if')] = expr
  }

  // loop → v-for
  const loop = node.bindings?.loop
  if (loop) {
    const config = isExpressionBinding(loop)
      ? { source: loop.value, itemName: 'item', indexName: 'index' }
      : (loop.value as { source: string; itemName: string; indexName?: string })
    const source = rewriteExpression(config.source, ctx.datasourceIds, ctx.variableNames)
    const loopExpr = config.indexName
      ? `(${config.itemName}, ${config.indexName}) in ${source}`
      : `${config.itemName} in ${source}`
    attrs[directive('v-for')] = loopExpr
  }

  // style → :style
  const style: Record<string, string> = {}
  for (const [key, binding] of Object.entries(node.style ?? {})) {
    if (isExpressionBinding(binding)) {
      style[key] = rewriteExpression(binding.value, ctx.datasourceIds, ctx.variableNames)
    } else {
      style[key] = typeof binding.value === 'string' ? `'${binding.value}'` : toJson(binding.value)
    }
  }
  if (Object.keys(style).length > 0) {
    attrs[bind('style')] = `{ ${Object.entries(style).map(([k, v]) => `${k}: ${v}`).join(', ')} }`
  }

  // 事件 → @click 等
  for (const eventName of Object.keys(node.events ?? {})) {
    attrs[on(eventName)] = `on${pascalCase(eventName)}_${node.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`
  }

  const children: TemplateNode[] = []
  for (const childId of node.children ?? []) {
    const child = ctx.allNodes.find((n) => n.id === childId)
    if (child) children.push(nodeToAst(child, ctx))
  }
  return el(tag, attrs, children)
}

/** 生成脚本 setup：数据源 / 变量 / 动作助手 / 事件处理器 */
function buildScript(schema: PageSchema, ctx: { datasourceIds: string[]; variableNames: string[] }): string {
  const lines: string[] = []
  lines.push("import { reactive, ref, onMounted } from 'vue'")
  lines.push("import { LcContainer, LcText, LcButton, LcInput, LcSelect, LcImage, LcTable, LcDialog } from '@lowcode/materials'")
  lines.push('')

  // 数据源 ref
  for (const source of schema.dataSources) {
    const refName = camelCase(source.id)
    if (source.type === 'static') {
      lines.push(`const ${refName} = ref(${toJson(source.config.staticData ?? [])})`)
    } else {
      lines.push(`const ${refName} = ref([])`)
      lines.push(`const ${refName}State = reactive({ status: 'idle', error: '' })`)
      const url = source.config.url ? toJson(source.config.url) : "''"
      lines.push(`async function load${pascalCase(source.id)}() {`)
      lines.push(`  ${refName}State.status = 'loading'`)
      lines.push(`  try {`)
      lines.push(`    const res = await fetch(${url})`)
      lines.push(`    ${refName}.value = await res.json()`)
      lines.push(`    ${refName}State.status = 'success'`)
      lines.push(`  } catch (error) {`)
      lines.push(`    ${refName}State.status = 'error'`)
      lines.push(`    ${refName}State.error = String(error)`)
      lines.push(`  }`)
      lines.push(`}`)
    }
    lines.push('')
  }

  // 页面变量 ref
  for (const variable of schema.variables) {
    lines.push(`const ${variable.name} = ref(${toJson(variable.value)})`)
  }
  if (schema.variables.length > 0) lines.push('')

  // 弹窗与属性覆盖
  lines.push('const dialogs = reactive({})')
  lines.push('const propsOverride = reactive({})')
  lines.push('const requestResult = ref(null)')
  lines.push('')
  lines.push('function setProp(nodeId, prop, value) {')
  lines.push('  propsOverride[nodeId] ??= {}')
  lines.push('  propsOverride[nodeId][prop] = value')
  lines.push('}')
  lines.push('')

  // 动作助手
  lines.push('function runAction(action) {')
  lines.push('  switch (action.kind) {')
  lines.push("    case 'setProp':")
  lines.push('      setProp(action.config.nodeId ?? "", action.config.prop, action.config.value)')
  lines.push('      break')
  lines.push("    case 'openDialog':")
  lines.push("      dialogs[action.config.dialogId] = true")
  lines.push('      break')
  lines.push("    case 'closeDialog':")
  lines.push("      dialogs[action.config.dialogId] = false")
  lines.push('      break')
  lines.push("    case 'emitEvent':")
  lines.push('      window.dispatchEvent(new CustomEvent(action.config.event, { detail: action.config.payload }))')
  lines.push('      break')
  lines.push("    case 'request':")
  lines.push('      fetch(action.config.url ?? "").then((res) => res.json()).then((data) => { requestResult.value = data })')
  lines.push('      break')
  lines.push("    case 'navigate':")
  lines.push('      location.hash = action.config.route')
  lines.push('      break')
  lines.push('    default:')
  lines.push("      console.warn('[codegen] 未支持的动作类型', action.kind)")
  lines.push('  }')
  lines.push('}')
  lines.push('')

  // 事件处理器
  for (const node of schema.nodes) {
    for (const [eventName, actions] of Object.entries(node.events ?? {})) {
      const handlerName = `on${pascalCase(eventName)}_${node.id.replace(/[^a-zA-Z0-9_$]/g, '_')}`
      lines.push(`function ${handlerName}(event) {`)
      lines.push(`  const actions = ${toJson(actions)}`)
      lines.push('  for (const action of actions) {')
      for (const action of actions) {
        if (action.when) {
          const rewritten = rewriteExpression(action.when, ctx.datasourceIds, ctx.variableNames)
          lines.push(`    if (!(${rewritten})) continue`)
        }
        lines.push(`    runAction(${toJson(action)})`)
      }
      lines.push('  }')
      lines.push('}')
      lines.push('')
    }
  }

  const loads = schema.dataSources
    .filter((source) => source.type !== 'static')
    .map((source) => `  load${pascalCase(source.id)}()`)
  if (loads.length > 0) {
    lines.push('onMounted(() => {')
    lines.push(loads.join('\n'))
    lines.push('})')
  }

  return lines.join('\n')
}

/** Vue SFC 生成器：Schema → 模板 AST → Prettier → 可运行 SFC */
export class VueSfcGenerator implements ICodeGenerator {
  async generate(schema: PageSchema): Promise<GeneratedCode> {
    const datasourceIds = schema.dataSources.map((source) => source.id)
    const variableNames = schema.variables.map((variable) => variable.name)
    const ctx = {
      datasourceIds,
      variableNames,
      allNodes: schema.nodes,
    }
    const rootChildren: TemplateNode[] = schema.nodes
      .filter((node) => !ctx.allNodes.some((other) => [...(other.children ?? []), ...Object.values(other.slots ?? {}).flat()].includes(node.id)))
      .map((node) => nodeToAst(node, ctx))
    const root = el('div', { class: 'lc-page' }, rootChildren)
    const template = stringifyTemplate(root)
    const script = buildScript(schema, ctx)
    const style = [
      '.lc-page { padding: 16px; }',
      '.lc-page > * { margin-bottom: 8px; }',
    ].join('\n')
    const raw = [
      '<script setup lang="ts">',
      script,
      '</script>',
      '',
      '<template>',
      template,
      '</template>',
      '',
      '<style scoped>',
      style,
      '</style>',
    ].join('\n')
    const code = await prettier.format(raw, { parser: 'vue', semi: false })
    return {
      filename: `${schema.meta.name || 'page'}.vue`,
      code,
      template,
      script,
      style,
    }
  }
}

/** 便捷入口 */
export async function generateVueSfc(schema: PageSchema): Promise<GeneratedCode> {
  return new VueSfcGenerator().generate(schema)
}
