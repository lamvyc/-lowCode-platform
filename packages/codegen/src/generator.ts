import { format as formatWithPrettier } from 'prettier/standalone'
import * as prettierBabel from 'prettier/plugins/babel'
import * as prettierEstree from 'prettier/plugins/estree'
import * as prettierHtml from 'prettier/plugins/html'
import * as prettierPostcss from 'prettier/plugins/postcss'
import * as prettierTypescript from 'prettier/plugins/typescript'
import { getFormSettings, isExpressionBinding, type PageNode, type PageSchema } from '@lowcode/schema'
import { el, stringifyTemplate, type TemplateNode } from './ast'
import {
  buildFormAttrs,
  buildFormData,
  buildFormItemAttrs,
  resolveForm,
} from './form'
import { actionHandlerName, buildActionRuntime } from './actions'
import { buildDataSourceRuntime, dataSourceLoadName } from './datasources'
import { buildExpressionHelpers, rewriteExpression } from './expressions'
import { createDefaultRegistry } from './mappings'
import { renderChildren } from './mappings/helpers'
import type { ComponentMapping, MappingContext, MappingRegistry } from './mappings/types'
import { buildPlan, sanitizeIdentifier } from './plan'
import { buildRuleRuntime } from './rules'
import { buildNodeClass, buildNodeStyle, buildStyleBlock } from './styles'
import type { CodegenWarning, GeneratedCode } from './types'
import { buildRulesObject } from './validation'

export type { GeneratedCode } from './types'
export { rewriteExpression } from './expressions'

/**
 * Prettier 浏览器/Node 通用的 standalone 用法：
 * vue 解析器来自 html 插件，内嵌脚本用 babel + estree，内嵌样式用 postcss。
 */
const PRETTIER_PLUGINS = [
  prettierBabel,
  prettierEstree,
  prettierHtml,
  prettierPostcss,
  prettierTypescript,
]

/** 格式化 SFC；格式化不可用时回退为未格式化文本（结构仍然完整可解析） */
async function formatSfc(raw: string): Promise<string> {
  try {
    return await formatWithPrettier(raw, {
      parser: 'vue',
      semi: false,
      singleQuote: true,
      plugins: PRETTIER_PLUGINS,
    })
  } catch {
    return raw
  }
}

/** 代码生成器接口：未来可扩展 React / HTML */
export interface ICodeGenerator {
  generate(schema: PageSchema): Promise<GeneratedCode>
}

/** 自定义物料逃生口：type → 组件导入 */
export interface CodegenMaterialMapEntry {
  importName: string
  from: string
}

export type CodegenMaterialMap = Record<string, CodegenMaterialMapEntry>

export interface VueSfcGeneratorOptions {
  /** 自定义物料组件映射（优先级高于内置 Element Plus 映射） */
  materials?: CodegenMaterialMap
  /** 自定义映射注册表（测试/插件用） */
  registry?: MappingRegistry
}

/** el-form-item → ElFormItem；el-input → ElInput */
function elementComponentName(tag: string): string | undefined {
  if (!tag.startsWith('el-')) return undefined
  return (
    'El' +
    tag
      .slice(3)
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  )
}

function collectTags(node: TemplateNode, tags: Set<string>): void {
  if (node.kind !== 'element') return
  tags.add(node.tag)
  for (const child of node.children) collectTags(child, tags)
}

/** 字段的 columnWidth 落到控件本身（对齐物料 FormItem 的 control width） */
function applyColumnWidth(node: PageNode, target: TemplateNode): void {
  if (target.kind !== 'element') return
  const width = node.props.columnWidth
  if (typeof width !== 'string' || width === '') return
  const existing = typeof target.attrs.style === 'string' ? target.attrs.style : ''
  target.attrs.style = existing ? `${existing}; width: ${width}` : `width: ${width}`
}

function indentCode(code: string, spaces = 2): string {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n')
}

/** 应用 visible / loop 绑定到目标元素 */
function applyBindings(node: PageNode, target: TemplateNode, ctx: MappingContext): void {
  if (target.kind !== 'element') return
  const visible = node.bindings?.visible
  if (visible) {
    target.attrs['v-if'] = isExpressionBinding(visible)
      ? rewriteExpression(visible.value, ctx.datasourceIds, ctx.variableNames, 'template')
      : JSON.stringify(Boolean(visible.value))
  }
  const loop = node.bindings?.loop
  if (loop) {
    const config = isExpressionBinding(loop)
      ? { source: loop.value, itemName: 'item', indexName: 'index' }
      : (loop.value as { source: string; itemName: string; indexName?: string })
    const source = rewriteExpression(config.source, ctx.datasourceIds, ctx.variableNames, 'template')
    const indexName = config.indexName || 'index'
    target.attrs['v-for'] = `(${config.itemName}, ${indexName}) in ${source}`
    if (!target.attrs[':key']) target.attrs[':key'] = indexName
  }
}

/** 合并节点 style / class 到已生成元素 */
function applyStyleAndClass(
  node: PageNode,
  target: TemplateNode,
  ctx: MappingContext,
): void {
  if (target.kind !== 'element') return
  const nodeStyle = buildNodeStyle(node, ctx)
  if (nodeStyle) {
    const existingBinding = target.attrs[':style']
    const existingStatic = target.attrs.style
    if (typeof existingBinding === 'string') {
      delete target.attrs.style
      target.attrs[':style'] = `[${existingBinding}, ${nodeStyle}]`
    } else if (typeof existingStatic === 'string') {
      delete target.attrs.style
      target.attrs[':style'] = `[${JSON.stringify(existingStatic)}, ${nodeStyle}]`
    } else {
      target.attrs[':style'] = nodeStyle
    }
  }
  const existingClass = typeof target.attrs.class === 'string' ? target.attrs.class : undefined
  const merged = buildNodeClass(node, existingClass)
  if (merged) target.attrs.class = merged
}

/** Vue SFC 生成器：Schema → Element Plus 模板 AST → Prettier → 独立 SFC */
export class VueSfcGenerator implements ICodeGenerator {
  private readonly registry: MappingRegistry

  constructor(options: VueSfcGeneratorOptions = {}) {
    const registry = options.registry ?? createDefaultRegistry()
    for (const [type, entry] of Object.entries(options.materials ?? {})) {
      registry.registerComponent(type, {
        tag: entry.importName,
        importName: entry.importName,
        from: entry.from,
      })
    }
    this.registry = registry
  }

  async generate(schema: PageSchema): Promise<GeneratedCode> {
    const plan = buildPlan(schema, this.registry)
    const form = resolveForm(schema)
    const nodes = new Map(schema.nodes.map((node) => [node.id, node]))
    const warnings: CodegenWarning[] = plan.warnings
    const dynamicImports = new Map<string, Set<string>>()

    let ctx!: MappingContext

    const modelKey = (node: PageNode): string =>
      plan.modelKeys.get(node.id) ?? sanitizeIdentifier(node.name || node.id, node.id)

    const renderNode = (node: PageNode): TemplateNode => {
      const mapping = this.registry.get(node.type)
      const component = this.registry.component(node.type)

      if (!mapping && !component) {
        return { kind: 'comment', value: `未注册物料: ${node.type}` }
      }

      if (!mapping && component) {
        const element = el(component.tag, {}, renderChildren(node, ctx))
        applyStyleAndClass(node, element, ctx)
        return element
      }

      const current = mapping!
      const attrs: Record<string, string | true> = { ...current.attrs(node, ctx) }
      const interactiveAttrs: Record<string, string | true> = {
        'v-bind': `overrides[${JSON.stringify(node.id)}]`,
      }
      for (const eventName of Object.keys(node.events ?? {})) {
        interactiveAttrs[`@${eventName}`] = actionHandlerName(node.id, eventName)
      }
      Object.assign(attrs, interactiveAttrs)
      const modelTarget = current.model ?? 'value'
      if (current.field === true) {
        const target = `${form.modelName}.${modelKey(node)}`
        if (modelTarget === 'value') attrs['v-model'] = target
        else if (modelTarget === 'content') attrs['v-model:content'] = target
      }

      let element: TemplateNode
      if (current.render) {
        element = current.render(node, ctx)
        if (element.kind === 'element') Object.assign(element.attrs, interactiveAttrs)
      } else {
        element = el(current.tag, attrs, renderChildren(node, ctx))
      }

      if (current.field === true) {
        applyColumnWidth(node, element)
        const itemAttrs = buildFormItemAttrs(node, ctx)
        itemAttrs['v-bind'] = `overrides[${JSON.stringify(node.id)}]`
        const item = el('el-form-item', itemAttrs, [element])
        applyBindings(node, item, ctx)
        applyStyleAndClass(node, item, ctx)
        return item
      }

      applyBindings(node, element, ctx)
      applyStyleAndClass(node, element, ctx)
      return element
    }

    ctx = {
      schema,
      nodes,
      datasourceIds: schema.dataSources.map((source) => source.id),
      variableNames: schema.variables.map((variable) => variable.name),
      form,
      mode: 'template',
      warnings,
      warn: (code, message, nodeId) => warnings.push({ code, message, nodeId }),
      addImport: (name, from) => {
        const set = dynamicImports.get(from) ?? new Set<string>()
        set.add(name)
        dynamicImports.set(from, set)
      },
      modelKey,
      prop: (node, name) => node.props[name],
      renderNode,
      renderChildren: (node) => renderChildren(node, ctx),
    }

    const hasFields = plan.fieldNodes.length > 0
    const rootChildren = plan.rootNodes.map(renderNode)
    const root: TemplateNode = hasFields
      ? el('el-form', buildFormAttrs(form, true), rootChildren)
      : el('div', { class: 'lc-page' }, rootChildren)
    const template = stringifyTemplate(root)

    // ---- 导入收集 ----
    const tags = new Set<string>()
    collectTags(root, tags)

    const elementPlusImports = new Set<string>()
    for (const tag of tags) {
      const name = elementComponentName(tag)
      if (name) elementPlusImports.add(name)
    }

    const componentByTag = new Map<string, ComponentMapping>()
    const extraImports = new Map<string, Set<string>>()
    const sideEffectImports = new Set<string>()
    for (const node of schema.nodes) {
      const component = this.registry.component(node.type)
      if (component) componentByTag.set(component.tag, component)
      const mapping = this.registry.get(node.type)
      for (const entry of mapping?.imports ?? []) {
        const set = extraImports.get(entry.from) ?? new Set<string>()
        set.add(entry.name)
        extraImports.set(entry.from, set)
      }
      for (const spec of mapping?.sideEffectImports ?? []) sideEffectImports.add(spec)
    }
    for (const tag of tags) {
      const component = componentByTag.get(tag)
      if (!component) continue
      const set = extraImports.get(component.from) ?? new Set<string>()
      set.add(component.importName)
      extraImports.set(component.from, set)
    }

    // ---- setup 代码 ----
    const setupLines: string[] = []
    for (const node of schema.nodes) {
      const lines = this.registry.get(node.type)?.setup?.(node, ctx) ?? []
      // 按节点整体追加：不能按单行去重（函数体的 `}` 行会重复，去重会把后续函数截断）
      setupLines.push(...lines)
    }

    const formSettings = getFormSettings(schema.settings)
    const dataRuntime = buildDataSourceRuntime(schema)
    const ruleRuntime = buildRuleRuntime(schema, {
      datasourceIds: schema.dataSources.map((source) => source.id),
      variableNames: schema.variables.map((variable) => variable.name),
    })
    const needsWatch = (Boolean(formSettings.onFormDataChange) && hasFields) || ruleRuntime.needsWatch
    const nodeCreatedHooks: Array<{ node: PageNode; code: string; key: string }> = []
    const nodeMountedHooks: Array<{ node: PageNode; code: string; key: string }> = []
    for (const node of schema.nodes) {
      const key = plan.modelKeys.get(node.id) ?? modelKey(node)
      if (typeof node.props.onCreated === 'string' && node.props.onCreated.trim() !== '') {
        nodeCreatedHooks.push({ node, code: node.props.onCreated, key })
      }
      if (typeof node.props.onMounted === 'string' && node.props.onMounted.trim() !== '') {
        nodeMountedHooks.push({ node, code: node.props.onMounted, key })
      }
    }
    const needsMounted =
      Boolean(formSettings.onFormMounted) ||
      dataRuntime.mountCalls.length > 0 ||
      ruleRuntime.needsMounted ||
      nodeMountedHooks.length > 0
    const needsBeforeUnmount = dataRuntime.cleanupLines.length > 0

    const scriptLines: string[] = ['// 由低代码设计器生成']
    const vueImports = ['reactive', 'ref']
    if (needsWatch) vueImports.push('watch')
    if (needsMounted) vueImports.push('onMounted')
    if (needsBeforeUnmount) vueImports.push('onBeforeUnmount')
    scriptLines.push(`import { ${vueImports.join(', ')} } from 'vue'`)
    if (elementPlusImports.size > 0) {
      scriptLines.push(
        `import { ${[...elementPlusImports].sort().join(', ')} } from 'element-plus'`,
      )
    }
    for (const [from, names] of dynamicImports) {
      const set = extraImports.get(from) ?? new Set<string>()
      for (const name of names) set.add(name)
      extraImports.set(from, set)
    }
    for (const [from, names] of extraImports) {
      scriptLines.push(`import { ${[...names].sort().join(', ')} } from '${from}'`)
    }
    for (const spec of sideEffectImports) {
      scriptLines.push(`import '${spec}'`)
    }
    scriptLines.push('')

    scriptLines.push(buildExpressionHelpers())
    scriptLines.push('')

    for (const variable of schema.variables) {
      const name = sanitizeIdentifier(variable.name, 'variable')
      if (name !== variable.name) {
        warnings.push({
          code: 'variable-name',
          message: `页面变量「${variable.name}」不是合法标识符，已用「${name}」代替`,
        })
      }
      scriptLines.push(`const ${name} = ref(${JSON.stringify(variable.value ?? null)})`)
    }
    if (schema.variables.length > 0) scriptLines.push('')

    scriptLines.push(...dataRuntime.lines)
    if (dataRuntime.lines.length > 0) scriptLines.push('')
    warnings.push(...dataRuntime.warnings)

    scriptLines.push(
      ...buildActionRuntime(schema, {
        modelName: form.modelName,
        variableNames: schema.variables.map((variable) => variable.name),
        datasourceIds: schema.dataSources.map((source) => source.id),
        dataSources: schema.dataSources.map((source) => ({
          id: source.id,
          loadName: dataSourceLoadName(source.id),
        })),
      }),
    )
    scriptLines.push(...ruleRuntime.lines)

    scriptLines.push(`const ${form.modelName} = reactive(${buildFormData(plan, this.registry)})`)
    scriptLines.push(`const ${form.refName} = ref()`)
    scriptLines.push(`const ${form.rulesName} = ${buildRulesObject(plan, ctx)}`)
    if (setupLines.length > 0) {
      scriptLines.push(setupLines.join('\n'))
    }

    if (formSettings.functions) {
      scriptLines.push(formSettings.functions)
    }

    if (formSettings.onFormCreated) {
      scriptLines.push(
        `try {\n${indentCode(formSettings.onFormCreated)}\n} catch (error) {\n  console.warn('[codegen] onFormCreated 执行失败', error)\n}`,
      )
    }

    for (const hook of nodeCreatedHooks) {
      const self = `self_${sanitizeIdentifier(hook.node.id, 'node')}`
      scriptLines.push(
        `const ${self} = { node: ${JSON.stringify(hook.node.id)}, get value() { return ${form.modelName}.${hook.key} }, setValue(v) { ${form.modelName}.${hook.key} = v }, getValue() { return ${form.modelName}.${hook.key} } }`,
      )
      scriptLines.push(
        `try {\n  ;(function () {\n${indentCode(hook.code, 4)}\n  }).call(${self})\n} catch (error) {\n  console.warn('[codegen] onCreated 执行失败', error)\n}`,
      )
    }

    if (dataRuntime.mountCalls.length > 0) {
      scriptLines.push(`onMounted(() => {\n${dataRuntime.mountCalls.join('\n')}\n})`)
    }

    if (nodeMountedHooks.length > 0) {
      const calls = nodeMountedHooks.map((hook) => {
        const self = `self_${sanitizeIdentifier(hook.node.id, 'node')}`
        return `  try {\n    ;(function () {\n${indentCode(hook.code, 6)}\n    }).call(${self})\n  } catch (error) {\n    console.warn('[codegen] onMounted 执行失败', error)\n  }`
      })
      scriptLines.push(`onMounted(() => {\n${calls.join('\n')}\n})`)
    }

    if (needsMounted && formSettings.onFormMounted) {
      scriptLines.push(
        `onMounted(() => {\n  try {\n${indentCode(formSettings.onFormMounted, 4)}\n  } catch (error) {\n    console.warn('[codegen] onFormMounted 执行失败', error)\n  }\n})`,
      )
    }

    if (needsBeforeUnmount) {
      scriptLines.push(`onBeforeUnmount(() => {\n${dataRuntime.cleanupLines.join('\n')}\n})`)
    }

    if (ruleRuntime.needsMounted) {
      scriptLines.push(`onMounted(() => {\n  runRules('mount')\n})`)
    }

    if (ruleRuntime.needsWatch) {
      scriptLines.push(
        `watch(\n  () => ${form.modelName},\n  () => runRules('expression'),\n  { deep: true },\n)`,
      )
    }

    if (needsWatch) {
      for (const node of plan.fieldNodes) {
        const key = plan.modelKeys.get(node.id) ?? modelKey(node)
        scriptLines.push(
          `watch(\n  () => ${form.modelName}.${key},\n  (newValue, oldValue) => {\n    try {\n      const fieldName = ${JSON.stringify(key)}\n      const formModel = ${form.modelName}\n${indentCode(formSettings.onFormDataChange!, 6)}\n    } catch (error) {\n      console.warn('[codegen] onFormDataChange 执行失败', error)\n    }\n  },\n)`,
        )
      }
    }

    const script = scriptLines.join('\n')

    // ---- 样式 ----
    const { scoped, global } = buildStyleBlock(plan)
    const style = [scoped, global].filter(Boolean).join('\n\n')

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
      scoped,
      '</style>',
      ...(global ? ['', '<style>', global, '</style>'] : []),
    ].join('\n')

    const code = await formatSfc(raw)
    return {
      filename: `${schema.meta.name || 'page'}.vue`,
      code,
      template,
      script,
      style,
      warnings,
    }
  }
}

/** 便捷入口 */
export async function generateVueSfc(
  schema: PageSchema,
  options?: VueSfcGeneratorOptions,
): Promise<GeneratedCode> {
  return new VueSfcGenerator(options).generate(schema)
}
