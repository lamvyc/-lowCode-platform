import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeTag, type ReferenceBoundAttr } from './reference-spec'

/**
 * 本仓库物料组件的静态规格抽取（解析 SFC 源码，无需编译）。
 * 用于与参考实现比对：属性是否声明、UI 属性是否绑定。
 */

export interface ComponentBoundAttr {
  tag: string
  attr: string
  /** 绑定的表达式原文 */
  expression: string
}

export interface ComponentSpec {
  /** 组件文件名，如 Number.vue */
  file: string
  /** defineOptions({ name }) 中的组件名 */
  componentName: string
  /** defineProps 声明的属性名 */
  props: string[]
  /** 模板中绑定的属性 */
  boundAttrs: ComponentBoundAttr[]
  /** 模板中监听的事件 */
  domEvents: string[]
}

/** 去掉注释，避免注释里的 `name:` 被当成属性声明 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** 抽取 `defineProps<{ ... }>()` 的第一层属性名 */
export function extractDeclaredProps(source: string): string[] {
  const body = extractGenericObjectBody(stripComments(source), 'defineProps<')
  if (!body) return []

  const props: string[] = []
  let depth = 0
  let chunk = ''
  const flush = (): void => {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/.exec(chunk)
    if (match) props.push(match[1])
    chunk = ''
  }

  for (const char of body) {
    if (char === '{' || char === '(' || char === '[') depth += 1
    else if (char === '}' || char === ')' || char === ']') depth -= 1
    if (depth === 0 && (char === '\n' || char === ';' || char === ',')) {
      flush()
      continue
    }
    chunk += char
  }
  flush()
  return props
}

/** 取 `marker` 之后第一个 `{...}` 的内容（按括号配平） */
function extractGenericObjectBody(source: string, marker: string): string | null {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const open = source.indexOf('{', start)
  if (open < 0) return null

  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }
  return null
}

/** 抽取 `defineOptions({ name: 'Xxx' })` */
export function extractComponentName(source: string): string {
  return /defineOptions\(\{\s*name:\s*'([^']+)'/.exec(stripComments(source))?.[1] ?? ''
}

const TAG_RE = /<([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g

/** 抽取模板中绑定的属性（`:attr="expr"`） */
export function extractComponentBoundAttrs(source: string): ComponentBoundAttr[] {
  const found: ComponentBoundAttr[] = []
  for (const tagMatch of source.matchAll(TAG_RE)) {
    const tag = normalizeTag(tagMatch[1])
    for (const attrMatch of tagMatch[2].matchAll(/:([\w-]+)="([^"]*)"/g)) {
      found.push({ tag, attr: attrMatch[1], expression: attrMatch[2].trim() })
    }
  }
  return found
}

/** 读取单个组件文件的规格 */
export function loadComponentSpec(componentsDir: string, file: string): ComponentSpec {
  const source = readFileSync(join(componentsDir, file), 'utf8')
  return {
    file,
    componentName: extractComponentName(source),
    props: extractDeclaredProps(source),
    boundAttrs: extractComponentBoundAttrs(source),
    domEvents: [...new Set([...source.matchAll(/@([\w-]+)(?:\.\w+)*="/g)].map((m) => m[1]))],
  }
}

/** 读取目录下全部 `*.vue` 组件规格（排除表单外壳） */
export function loadComponentSpecs(
  componentsDir: string,
  exclude: string[] = [],
): ComponentSpec[] {
  if (!existsSync(componentsDir)) return []
  return readdirSync(componentsDir)
    .filter((file) => file.endsWith('.vue') && !exclude.includes(file))
    .sort()
    .map((file) => loadComponentSpec(componentsDir, file))
}

/** 某组件是否绑定了指定标签上的属性 */
export function hasBoundAttr(
  spec: ComponentSpec | undefined,
  tag: string,
  attr: string,
): boolean {
  if (!spec) return false
  return spec.boundAttrs.some((bound) => bound.tag === tag && bound.attr === attr)
}

export type { ReferenceBoundAttr }
