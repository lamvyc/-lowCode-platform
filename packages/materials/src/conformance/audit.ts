import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MaterialManifest } from '../manifest'
import {
  hasBoundAttr,
  loadComponentSpecs,
  type ComponentSpec,
} from './component-spec'
import {
  loadReferenceSpec,
  REPO_ROOT,
  type ReferenceSpec,
  type ReferenceWidgetSpec,
} from './reference-spec'

/**
 * 参考实现 ↔ 本仓库 的一致性审计。
 *
 * 三类差异都会被检出：
 *   1. missingOptions —— 参考模板真正读取的属性，本仓库物料清单里没有
 *   2. missingEvents  —— 参考声明的事件（onXxx），本仓库 events 里没有
 *   3. missingAttrs   —— 参考绑定到 Element 组件的 UI 属性，本仓库组件模板里没有绑定
 *
 * 允许的偏离必须显式登记在 WAIVERS 中并写明原因 —— 这样"抄漏了"和"有意不同"不会混在一起，
 * 也不会随时间悄悄漂移。
 */

/** 参考 widget 类型 → 本仓库物料类型 */
export const WIDGET_TYPE_ALIASES: Record<string, string> = {
  // 表格相关已与参考对齐同名（`table` / `table-cell`），不再需要别名。
  // 这张表保留，供将来出现新的命名差异时登记。
}

/** 参考 option → 本仓库属性（全局重命名） */
export const GLOBAL_OPTION_ALIASES: Record<string, string> = {
  defaultValue: 'modelValue',
  customClass: 'class',
}

/** 参考 option → 本仓库属性（逐 widget 重命名） */
export const WIDGET_OPTION_ALIASES: Record<string, Record<string, string>> = {
  // 按钮文案已改回与参考同名（`label`），这条别名不再需要
  'tab-pane': { name: 'paneName' },
}

export type WaiverKind = 'widget' | 'option' | 'event' | 'attr'

export interface ConformanceWaiver {
  /** 参考 widget 类型 */
  widget: string
  kind: WaiverKind
  /** option 名 / 事件名 / `标签:属性` / widget 类型 */
  reference: string
  reason: string
}

/**
 * 有意偏离清单：每条都必须给出原因。
 * 这里只登记"已确认属于参考实现或上游 UI 库差异"的项，不能用来掩盖遗漏。
 */
export const WAIVERS: ConformanceWaiver[] = [
  // 注：onCreated / onMounted / onValidate 曾作为宽免项，现已按参考实现补齐为
  // `control: 'code'` 的事件类 propConfig（事件设置里可见），因此不再需要宽免。

  // ---- 承载位置差异：参考把内部结构渲染在父模板里，本平台拆成子组件 ----
  {
    widget: 'grid',
    kind: 'attr',
    reference: 'gridcolwidget:col-height',
    reason:
      '子节点由渲染器按 Schema 独立渲染，父容器无法向子组件传 prop；本平台用可继承的 CSS 变量把 colHeight 下传，并在 GridCol 上写成逐列 height —— 与参考的逐列高度语义等价，只是承载位置不同',
  },
  {
    widget: 'button',
    kind: 'attr',
    reference: 'staticcontentwrapper:display-style',
    reason:
      '本实现没有 static-content-wrapper 外壳，displayStyle 直接换算为按钮自身宽度（block → 100%）',
  },
  {
    widget: 'static-text',
    kind: 'attr',
    reference: 'pre:style',
    reason: 'preWrap 用 div 的 white-space 表达，未使用 <pre> 元素（功能等价）',
  },
  {
    widget: 'rich-editor',
    kind: 'attr',
    reference: 'vueeditor:disabled',
    reason: '富文本为自研 contenteditable 实现（不引入第三方富文本库），disabled 由组件内部 DOM 处理',
  },
  {
    widget: 'rich-editor',
    kind: 'attr',
    reference: 'vueeditor:placeholder',
    reason: '同上：占位文案由 contenteditable 的 :empty::before 实现',
  },

  // ---- 上游 UI 库 API 差异（Element UI 2.x → Element Plus）----
  {
    widget: 'radio',
    kind: 'attr',
    reference: 'elradiobutton:border',
    reason: 'Element Plus 的 el-radio-button 已移除 border 属性（仅 el-radio 支持）',
  },
  {
    widget: 'checkbox',
    kind: 'attr',
    reference: 'elcheckboxbutton:border',
    reason: 'Element Plus 的 el-checkbox-button 已移除 border 属性（仅 el-checkbox 支持）',
  },
  {
    widget: 'input',
    kind: 'attr',
    reference: 'elbutton:class',
    reason: 'Element Plus 的按钮图标用 icon（组件）而非 class，本实现绑定为 :icon',
  },
]

export interface WidgetConformance {
  referenceType: string
  ourType: string
  componentFile: string
  status: 'ok' | 'gaps' | 'missing-widget'
  missingOptions: string[]
  missingEvents: string[]
  missingAttrs: string[]
  unusedOptions: string[]
  extraOptions: string[]
  waived: string[]
}

export interface ConformanceReport {
  referenceDir: string
  widgets: WidgetConformance[]
  missingWidgets: string[]
  extraWidgets: string[]
  summary: {
    referenceWidgets: number
    checkedWidgets: number
    ok: number
    withGaps: number
    missingWidgets: number
    missingOptions: number
    missingEvents: number
    missingAttrs: number
    waived: number
  }
}

/**
 * 从 materials.ts 文本解析「物料类型 → 组件文件」映射。
 * 不 import .vue，避免审计脚本依赖 Vue 编译。
 */
export function loadMaterialComponentMap(
  materialsPath = join(REPO_ROOT, 'packages/materials/src/materials.ts'),
): Map<string, string> {
  if (!existsSync(materialsPath)) return new Map()
  const source = readFileSync(materialsPath, 'utf8')

  const importedFrom: Record<string, string> = {}
  for (const match of source.matchAll(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+'\.\/components\/([\w.-]+\.vue)'/g,
  )) {
    importedFrom[match[1]] = match[2]
  }

  const map = new Map<string, string>()
  // 只取 MATERIAL_COMPONENTS 对象字面量内部，避免误匹配文件里其它 `key: ident,` 行
  const body = /MATERIAL_COMPONENTS[^{]*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
  for (const match of body.matchAll(/^\s*'?([\w-]+)'?\s*:\s*([A-Za-z_$][\w$]*)\s*,/gm)) {
    const file = importedFrom[match[2]]
    if (file) map.set(match[1], file)
  }
  return map
}

export function mapOption(widgetType: string, referenceOption: string): string {
  return (
    WIDGET_OPTION_ALIASES[widgetType]?.[referenceOption] ??
    GLOBAL_OPTION_ALIASES[referenceOption] ??
    referenceOption
  )
}

function waiverFor(
  widgetType: string,
  kind: WaiverKind,
  reference: string,
): ConformanceWaiver | undefined {
  return WAIVERS.find(
    (waiver) =>
      (waiver.widget === widgetType || waiver.widget === '*') &&
      waiver.kind === kind &&
      waiver.reference === reference,
  )
}

export interface AuditInput {
  reference: ReferenceSpec
  manifests: MaterialManifest[]
  componentMap: Map<string, string>
  componentsDir: string
}

/** 执行审计 */
export function auditConformance(input: AuditInput): ConformanceReport {
  const { reference, manifests, componentMap, componentsDir } = input
  const manifestByType = new Map(manifests.map((manifest) => [manifest.type, manifest]))
  const componentSpecs = new Map<string, ComponentSpec>(
    loadComponentSpecs(componentsDir, ['FormItem.vue']).map((spec) => [spec.file, spec]),
  )

  const widgets: WidgetConformance[] = []
  const missingWidgets: string[] = []

  for (const widget of reference.widgets) {
    if (widget.group === 'custom') continue
    const ourType = WIDGET_TYPE_ALIASES[widget.type] ?? widget.type
    const manifest = manifestByType.get(ourType)
    const componentFile = componentMap.get(ourType) ?? ''

    if (!manifest) {
      missingWidgets.push(widget.type)
      widgets.push({
        referenceType: widget.type,
        ourType,
        componentFile,
        status: 'missing-widget',
        missingOptions: widget.usedOptionKeys,
        missingEvents: widget.eventKeys,
        missingAttrs: widget.boundAttrs.map((bound) => `${bound.tag}:${bound.attr}`),
        unusedOptions: [],
        extraOptions: [],
        waived: [],
      })
      continue
    }

    const missingOptions: string[] = []
    const missingEvents: string[] = []
    const missingAttrs: string[] = []
    const waived: string[] = []
    const ourPropNames = new Set(manifest.propConfigs.map((config) => config.name))
    const mappedOptionNames = new Set<string>()

    for (const option of widget.usedOptionKeys) {
      // onXxx 属于事件（由下面的 events 检查覆盖），不作为属性比对
      if (/^on[A-Z]/.test(option)) continue
      const mapped = mapOption(widget.type, option)
      mappedOptionNames.add(mapped)
      if (ourPropNames.has(mapped)) continue
      if (waiverFor(widget.type, 'option', option)) {
        waived.push(`option:${option}`)
        continue
      }
      missingOptions.push(`${option}${mapped === option ? '' : `（→${mapped}）`}`)
    }

    // 事件类 propConfig（onCreated / onMounted / onValidate 等代码型事件）
    // 与 material.events 一起构成"已声明事件"的全集。
    const ourEventLabels = new Set([
      ...(manifest.events ?? []).map((event) => event.label ?? event.name),
      ...manifest.propConfigs
        .filter((config) => config.group === 'event')
        .map((config) => config.name),
    ])
    for (const event of widget.eventKeys) {
      if (ourEventLabels.has(event)) continue
      if (waiverFor(widget.type, 'event', event)) {
        waived.push(`event:${event}`)
        continue
      }
      missingEvents.push(event)
    }

    // 组件闭包：物料自身 + 内部结构子物料（如 tab → tab-pane）。
    // 参考实现把内部结构渲染在同一个模板里，本平台拆成独立子组件承载。
    const closureTypes: string[] = []
    const collectClosure = (type: string): void => {
      if (closureTypes.includes(type)) return
      closureTypes.push(type)
      for (const child of manifestByType.get(type)?.defaultChildren ?? []) {
        collectClosure(child.type)
      }
    }
    collectClosure(ourType)
    const closure = closureTypes
      .map((type) => componentMap.get(type))
      .map((file) => (file ? componentSpecs.get(file) : undefined))
      .filter((spec): spec is ComponentSpec => Boolean(spec))

    for (const bound of widget.boundAttrs) {
      const key = `${bound.tag}:${bound.attr}`
      if (closure.some((spec) => hasBoundAttr(spec, bound.tag, bound.attr))) continue
      if (waiverFor(widget.type, 'attr', key)) {
        waived.push(`attr:${key}`)
        continue
      }
      missingAttrs.push(`${key}（←${bound.option}）`)
    }

    const unusedOptions = widget.optionKeys.filter(
      (key) => !widget.usedOptionKeys.includes(key) && !/^on[A-Z]/.test(key),
    )
    const extraOptions = manifest.propConfigs
      .map((config) => config.name)
      .filter((name) => !mappedOptionNames.has(name) && !['name', 'hidden', 'style', 'class'].includes(name))

    widgets.push({
      referenceType: widget.type,
      ourType,
      componentFile,
      status: missingOptions.length || missingEvents.length || missingAttrs.length ? 'gaps' : 'ok',
      missingOptions,
      missingEvents,
      missingAttrs,
      unusedOptions,
      extraOptions,
      waived,
    })
  }

  const referenceTypes = new Set(reference.widgets.map((widget) => widget.type))
  const extraWidgets = manifests
    .filter((manifest) => !manifest.hidden)
    .map((manifest) => manifest.type)
    .filter((type) => !referenceTypes.has(type) && !Object.values(WIDGET_TYPE_ALIASES).includes(type))

  const sum = (pick: (widget: WidgetConformance) => string[]): number =>
    widgets.reduce((total, widget) => total + pick(widget).length, 0)

  return {
    referenceDir: reference.sourceDir,
    widgets,
    missingWidgets,
    extraWidgets,
    summary: {
      referenceWidgets: reference.widgets.filter((widget) => widget.group !== 'custom').length,
      checkedWidgets: widgets.length,
      ok: widgets.filter((widget) => widget.status === 'ok').length,
      withGaps: widgets.filter((widget) => widget.status === 'gaps').length,
      missingWidgets: missingWidgets.length,
      missingOptions: sum((widget) => widget.missingOptions),
      missingEvents: sum((widget) => widget.missingEvents),
      missingAttrs: sum((widget) => widget.missingAttrs),
      waived: sum((widget) => widget.waived),
    },
  }
}

/** 渲染 Markdown 报告 */
export function renderReportMarkdown(report: ConformanceReport): string {
  const lines: string[] = []
  const { summary } = report

  lines.push('# 组件库一致性报告（参考实现 ↔ 本仓库）')
  lines.push('')
  lines.push('> 由 `pnpm --filter @lowcode/materials test` 自动生成，请勿手工编辑。')
  lines.push(`> 参考实现目录：\`${report.referenceDir}\``)
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 指标 | 数值 |')
  lines.push('| --- | --- |')
  lines.push(`| 参考组件数 | ${summary.referenceWidgets} |`)
  lines.push(`| 已比对组件数 | ${summary.checkedWidgets} |`)
  lines.push(`| 完全一致 | ${summary.ok} |`)
  lines.push(`| 存在差异 | ${summary.withGaps} |`)
  lines.push(`| 缺失组件 | ${summary.missingWidgets} |`)
  lines.push(`| 缺失属性 | ${summary.missingOptions} |`)
  lines.push(`| 缺失事件 | ${summary.missingEvents} |`)
  lines.push(`| 缺失 UI 绑定 | ${summary.missingAttrs} |`)
  lines.push(`| 已登记的有意偏离 | ${summary.waived} |`)
  lines.push('')

  if (report.missingWidgets.length > 0) {
    lines.push('## 缺失组件')
    lines.push('')
    for (const type of report.missingWidgets) lines.push(`- \`${type}\``)
    lines.push('')
  }

  lines.push('## 明细')
  lines.push('')
  lines.push('| 参考组件 | 本仓库类型 | 状态 | 缺失属性 | 缺失事件 | 缺失 UI 绑定 |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const widget of report.widgets) {
    const cell = (values: string[]): string => (values.length ? values.map((v) => `\`${v}\``).join('<br>') : '—')
    lines.push(
      `| ${widget.referenceType} | ${widget.ourType} | ${widget.status === 'ok' ? '✅' : widget.status === 'missing-widget' ? '❌ 缺失' : '⚠️ 差异'} | ${cell(widget.missingOptions)} | ${cell(widget.missingEvents)} | ${cell(widget.missingAttrs)} |`,
    )
  }
  lines.push('')

  const waivedWidgets = report.widgets.filter((widget) => widget.waived.length > 0)
  if (waivedWidgets.length > 0) {
    lines.push('## 已登记的有意偏离（契约）')
    lines.push('')
    lines.push('| 参考组件 | 类别 | 项目 | 原因 |')
    lines.push('| --- | --- | --- | --- |')
    for (const waiver of WAIVERS) {
      const scope = waiver.widget === '*' ? '全部' : waiver.widget
      lines.push(`| ${scope} | ${waiver.kind} | \`${waiver.reference}\` | ${waiver.reason} |`)
    }
    lines.push('')
    lines.push(
      `共 ${waivedWidgets.length} 个组件命中上述契约，逐组件命中明细见 \`docs/conformance-report.json\`。`,
    )
    lines.push('')
  }

  lines.push('## 本仓库额外物料（信息性）')
  lines.push('')
  lines.push(report.extraWidgets.map((type) => `\`${type}\``).join('、') || '—')
  lines.push('')

  return lines.join('\n')
}

/** 一次性加载 + 审计 + 渲染报告 */
export async function buildConformanceReport(options: {
  referenceDir: string
  manifests: MaterialManifest[]
  materialsPath?: string
  componentsDir?: string
}): Promise<{ report: ConformanceReport; markdown: string }> {
  const reference = await loadReferenceSpec(options.referenceDir)
  const componentsDir =
    options.componentsDir ?? join(REPO_ROOT, 'packages/materials/src/components')
  const report = auditConformance({
    reference,
    manifests: options.manifests,
    componentMap: loadMaterialComponentMap(options.materialsPath),
    componentsDir,
  })
  return { report, markdown: renderReportMarkdown(report) }
}

export type { ReferenceWidgetSpec }
