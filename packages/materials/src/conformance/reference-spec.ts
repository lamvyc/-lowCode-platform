import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * 参考实现（variant-form）规格抽取。
 *
 * 目标：把「参考实现长什么样」变成可执行的机器可读基线，用于自动比对，
 * 避免人工逐个组件核对。抽取三类信号：
 *   1. 声明面：widgetsConfig.js 里每个 widget 的 options 键（含 onXxx 事件）
 *   2. 使用面：widget 模板里真正被读取的 options（`field.options.X` / `widget.options.X`）
 *   3. 绑定面：模板里绑定到 Element UI 组件的属性（`:attr="...options.X"`）与事件（`@evt`）
 */

const HERE = dirname(fileURLToPath(import.meta.url))
/** 本仓库根目录 */
export const REPO_ROOT = resolve(HERE, '../../..', '..')

export type ReferenceGroup = 'container' | 'basic' | 'advanced' | 'custom'

/** widgetsConfig.js 中的一个 widget 声明 */
export interface ReferenceWidgetRecord {
  type: string
  group: ReferenceGroup
  formItemFlag: boolean
  internal: boolean
  /** 结构化字段（cols / rows / tabs / widgetList），表示该容器由内部结构承载子节点 */
  structuralKeys: string[]
  optionKeys: string[]
}

/** 模板里绑定到某个组件上的属性 */
export interface ReferenceBoundAttr {
  /** 归一化标签名：el-input → elinput */
  tag: string
  /** 绑定的属性名（kebab-case 原样） */
  attr: string
  /** 来源 option 名 */
  option: string
}

export interface ReferenceWidgetSpec extends ReferenceWidgetRecord {
  /** 模板 + 公共 wrapper 中真正被读取的 option（功能性属性） */
  usedOptionKeys: string[]
  /** 只在自身模板中被读取的 option */
  ownOptionKeys: string[]
  /** 模板中绑定的 UI 属性 */
  boundAttrs: ReferenceBoundAttr[]
  /** 模板中监听的 DOM/组件事件 */
  domEvents: string[]
  /** 声明的事件类 option（onXxx） */
  eventKeys: string[]
}

export interface ReferenceSpec {
  sourceDir: string
  widgets: ReferenceWidgetSpec[]
  /** form-item-wrapper 等公共外壳读取的 option（对所有 formItem 字段生效） */
  sharedOptionKeys: string[]
}

const WIDGETS_CONFIG = 'components/form-designer/widget-panel/widgetsConfig.js'
const FIELD_DIR = 'components/form-designer/form-widget/field-widget'
const CONTAINER_DIR = 'components/form-designer/form-widget/container-widget'

/** 解析参考实现目录：优先环境变量 VARIANT_FORM_SRC，其次仓库同级 variant-form/src */
export function resolveReferenceDir(): string | null {
  const candidates = [
    process.env.VARIANT_FORM_SRC,
    join(REPO_ROOT, '..', 'variant-form', 'src'),
  ].filter((dir): dir is string => Boolean(dir))

  for (const dir of candidates) {
    if (existsSync(join(dir, WIDGETS_CONFIG))) return resolve(dir)
  }
  return null
}

/**
 * 把参考仓库的 widgetsConfig.js 复制为临时 .mjs 后动态导入。
 * 参考工程是 CommonJS 工程（无 `type: module`），直接 import 会被当成 CJS 解析失败。
 */
async function importWidgetsConfig(sourceDir: string): Promise<Record<string, unknown>> {
  const source = readFileSync(join(sourceDir, WIDGETS_CONFIG), 'utf8')
  const dir = mkdtempSync(join(tmpdir(), 'variant-form-spec-'))
  const file = join(dir, 'widgetsConfig.mjs')
  writeFileSync(file, source)
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 读取 widgetsConfig 中的 widget 声明 */
export async function loadReferenceWidgets(
  sourceDir: string,
): Promise<ReferenceWidgetRecord[]> {
  const config = await importWidgetsConfig(sourceDir)
  const groups: Array<[ReferenceGroup, string]> = [
    ['container', 'containers'],
    ['basic', 'basicFields'],
    ['advanced', 'advancedFields'],
    ['custom', 'customFields'],
  ]

  const records: ReferenceWidgetRecord[] = []
  for (const [group, key] of groups) {
    const list = config[key]
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      if (!isRecord(raw) || typeof raw.type !== 'string') continue
      const options = isRecord(raw.options) ? raw.options : {}
      records.push({
        type: raw.type,
        group,
        formItemFlag: Boolean(raw.formItemFlag),
        internal: Boolean(raw.internal),
        structuralKeys: ['cols', 'rows', 'tabs', 'widgetList'].filter((name) => name in raw),
        optionKeys: Object.keys(options),
      })
    }
  }
  return records
}

/** 模板中读取过的 option（field.options.X / widget.options.X） */
export function extractUsedOptions(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/(?:field|widget)\.options\.([A-Za-z_$][\w$]*)/g)) {
    found.add(match[1])
  }
  return [...found]
}

const TAG_RE = /<([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g

/** 归一化组件标签：el-input / ElInput → elinput */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/-/g, '')
}

/** 模板中绑定到组件上的属性（`:attr="...options.X"`） */
export function extractBoundAttrs(source: string): ReferenceBoundAttr[] {
  const found: ReferenceBoundAttr[] = []
  for (const tagMatch of source.matchAll(TAG_RE)) {
    const tag = normalizeTag(tagMatch[1])
    for (const attrMatch of tagMatch[2].matchAll(/:([\w-]+)="([^"]*)"/g)) {
      const option = /options\.([A-Za-z_$][\w$]*)/.exec(attrMatch[2])
      if (option) found.push({ tag, attr: attrMatch[1], option: option[1] })
    }
  }
  return found
}

/** 模板中监听的 DOM/组件事件（`@click.native="..."` → click） */
export function extractDomEvents(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/@([\w-]+)(?:\.\w+)*="/g)) {
    found.add(match[1])
  }
  return [...found]
}

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

/** 组装参考实现规格 */
export async function loadReferenceSpec(sourceDir: string): Promise<ReferenceSpec> {
  const records = await loadReferenceWidgets(sourceDir)

  // 公共外壳读取的 option 对所有表单字段生效
  const sharedSource =
    readIfExists(join(sourceDir, FIELD_DIR, 'form-item-wrapper.vue')) +
    readIfExists(join(sourceDir, FIELD_DIR, 'static-content-wrapper.vue'))
  const sharedOptionKeys = extractUsedOptions(sharedSource)

  const widgets: ReferenceWidgetSpec[] = records.map((record) => {
    const dir = record.group === 'container' ? CONTAINER_DIR : FIELD_DIR
    const source = readIfExists(join(sourceDir, dir, `${record.type}-widget.vue`))
    const ownOptionKeys = extractUsedOptions(source)
    const used = new Set(ownOptionKeys)
    if (record.formItemFlag) for (const key of sharedOptionKeys) used.add(key)
    return {
      ...record,
      ownOptionKeys,
      usedOptionKeys: [...used],
      boundAttrs: extractBoundAttrs(source),
      domEvents: extractDomEvents(source),
      eventKeys: record.optionKeys.filter((key) => /^on[A-Z]/.test(key)),
    }
  })

  return { sourceDir, widgets, sharedOptionKeys }
}
