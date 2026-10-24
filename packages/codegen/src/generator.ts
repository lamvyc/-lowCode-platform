import { format as formatWithPrettier } from 'prettier/standalone'
import * as prettierBabel from 'prettier/plugins/babel'
import * as prettierEstree from 'prettier/plugins/estree'
import * as prettierHtml from 'prettier/plugins/html'
import * as prettierPostcss from 'prettier/plugins/postcss'
import * as prettierTypescript from 'prettier/plugins/typescript'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { el, stringifyTemplate, type TemplateNode } from './ast'
import {
  buildFormAttrs,
  buildFormData,
  buildFormItemAttrs,
  resolveForm,
} from './form'
import { createDefaultRegistry } from './mappings'
import { renderChildren } from './mappings/helpers'
import type { ComponentMapping, MappingContext, MappingRegistry } from './mappings/types'
import { buildPlan, sanitizeIdentifier } from './plan'
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
      if (current.field === true) {
        attrs['v-model'] = `${form.modelName}.${modelKey(node)}`
      }

      let element: TemplateNode
      if (current.render) {
        element = current.render(node, ctx)
      } else {
        element = el(current.tag, attrs, renderChildren(node, ctx))
      }

      if (current.field === true) {
        applyColumnWidth(node, element)
        const itemAttrs = buildFormItemAttrs(node, ctx)
        const item = el('el-form-item', itemAttrs, [element])
        applyStyleAndClass(node, item, ctx)
        return item
      }

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
    for (const node of schema.nodes) {
      const component = this.registry.component(node.type)
      if (component) componentByTag.set(component.tag, component)
      const mapping = this.registry.get(node.type)
      for (const entry of mapping?.imports ?? []) {
        const set = extraImports.get(entry.from) ?? new Set<string>()
        set.add(entry.name)
        extraImports.set(entry.from, set)
      }
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
      for (const line of lines) if (!setupLines.includes(line)) setupLines.push(line)
    }

    const scriptLines: string[] = ['// 由低代码设计器生成']
    const vueImports = hasFields ? ['reactive', 'ref'] : ['ref']
    scriptLines.push(`import { ${vueImports.join(', ')} } from 'vue'`)
    if (elementPlusImports.size > 0) {
      scriptLines.push(
        `import { ${[...elementPlusImports].sort().join(', ')} } from 'element-plus'`,
      )
    }
    for (const [from, names] of extraImports) {
      scriptLines.push(`import { ${[...names].sort().join(', ')} } from '${from}'`)
    }
    scriptLines.push('')

    if (hasFields) {
      scriptLines.push(`const ${form.modelName} = reactive(${buildFormData(plan, this.registry)})`)
      scriptLines.push(`const ${form.refName} = ref()`)
      scriptLines.push(`const ${form.rulesName} = ${buildRulesObject(plan, ctx)}`)
    }
    if (setupLines.length > 0) {
      scriptLines.push(setupLines.join('\n'))
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
