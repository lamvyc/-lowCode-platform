import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Element UI (参考实现) ↔ Element Plus (本仓库) 的**上游样式差异审计**。
 *
 * 为什么需要它：现有的 `audit.ts` 只覆盖"声明面"（props / events / 绑定是否存在），
 * 而线上真正难查的一类问题是**上游 CSS 语义变化被静默吞掉**。典型例子：
 *
 *   Element UI   `.el-radio-group { display: inline-block }`
 *   Element Plus `.el-radio-group { display: inline-flex }`
 *
 * 容器一旦变成 flex，子项的 `display` 会按 CSS 规范被「块化」（`inline` → `block`），
 * 于是 `radio` 的 `displayStyle` 绑在选项上的 `display` **完全失去作用**。
 * 这类问题静态审计看不见、happy-dom（无布局引擎）测不到、单测断言 inline style 字符串也测不到
 * —— 只能靠"机械比对上游 CSS"或"真机跑一遍"。
 *
 * 本模块做前者：把两份 CSS 的布局关键属性 diff 出来，再与**本仓库物料实际用到的组件**求交集，
 * 得到一份短而可执行的清单。逐条的真机复核见 `docs/interaction-spec/README.md` 7.8。
 */

/** 布局关键属性：会改变盒模型/定位/层级的，其余（颜色、圆角等）不影响"能不能用" */
const LAYOUT_PROPS = [
  'display',
  'position',
  'z-index',
  'overflow',
  'overflow-x',
  'overflow-y',
  'flex-direction',
  'align-items',
  'justify-content',
  'float',
  'vertical-align',
] as const

export type LayoutProp = (typeof LAYOUT_PROPS)[number]

/** 单条差异的严重度 */
export type DivergenceLevel =
  /** 去掉厂商前缀后仍不同，且 display 从 block/inline-block 变成 flex —— 会导致子项 display 被块化 */
  | 'semantic'
  /** 去掉厂商前缀后仍不同（position / z-index / overflow / flex 容器属性等） */
  | 'layout'
  /** 只是 -webkit-box / -webkit-flex 之类的厂商前缀现代化，无行为差异 */
  | 'prefix'

export interface Divergence {
  /** `.el-radio-group` 这类选择器 */
  selector: string
  /** 归属的根选择器（由物料 import 的组件推导，如 `.el-radio`） */
  root: string
  prop: LayoutProp
  elementUi: string
  elementPlus: string
  level: DivergenceLevel
}

/**
 * **会直接让我们样式失效的容器**——我们在这些容器的**子项**上绑了 `display`。
 *
 * 容器一旦变成 flex，其子项就成了 flex item，`display` 会按 CSS 规范被「块化」
 * （`inline` → `block`），绑在子项上的样式静默失效。radio 的 `displayStyle` 就是这么坏的。
 *
 * 只有这类差异会被测试**强制拦截**；其余语义变化只进报告供人工判断
 * ——因为"上游把某个元素的 display 改成 flex"本身不构成 bug，
 * 必须叠加"我们在它的子项上绑 display"才成立。
 */
export const CRITICAL_CONTAINERS: Array<{ selector: string; note: string }> = [
  {
    selector: '.el-radio-group',
    note: 'Radio.vue 在 .el-radio / .el-radio-button 上绑 displayStyle',
  },
  {
    selector: '.el-checkbox-group',
    note: 'Checkbox.vue 在 .el-checkbox / .el-checkbox-button 上绑 displayStyle',
  },
]

/**
 * 已复核结论：把"这条到底要不要管"的裁决固化下来。
 *
 * 只列**实际复核过**的条目（真机取证 / 代码核对），**不参与拦截**
 * （拦截只看 `CRITICAL_CONTAINERS`）。目的是避免"报告里那一堆 🔴 到底看没看过"的模糊状态。
 * 键为 `` `${selector}|${prop}` ``。
 */
export const REVIEWED_DIVERGENCES: Record<string, string> = {
  '.el-radio-group|display':
    '已修：EP 把容器改成 inline-flex，会使选项 display 被块化、displayStyle 静默失效。' +
    'Radio.vue 用 :deep 把容器恢复成 inline-block。真机实测 inline→1 行 / block→3 行 ✅',
  '.el-radio|display':
    '已修（同上）：容器已恢复为非 flex，因此 .el-radio 自身的 inline-block → inline-flex 不再影响' +
    '我们绑在它上面的 display。真机实测 computed 与预期一致 ✅',
  '.el-checkbox|display':
    '已修：本组件原先只在 block 时设样式，inline 时会落到 EP 默认的 inline-flex（参考实现给的是 inline，' +
    '两者在间距/基线对齐上不等价）。已改成无条件绑定。真机实测 inline→computed inline、block→3 行 ✅',
  '.el-checkbox__input|display':
    '不适用：我们只在 .el-checkbox 本身上绑 display，不在它的子项上绑，故容器是否 flex 无影响',
  '.el-input|display':
    '不适用：我们在 ElInput 本身上没有绑 display，其内部 wrapper 也未被我们改样式',
  '.el-input-group__append|display':
    '已复核：机制由 inline-table/table-cell 换成 flex，但"输入框 + 后置按钮并排"的结果保住了。' +
    '真机实测：组 inline-flex、同一行 ✅、水平相邻 ✅、输入框 730px + 后置区 40px 与组宽 814px 相符',
  '.el-input-group__prepend|display':
    '未使用：本仓库的 Input 只实现后置按钮（appendButton），没有 prepend 入口',
  '.el-tabs__item|display':
    '已复核：我们在 Tab.vue 未绑 display。真机实测 2 个标签项同行渲染正常（各 84×40，同一行）✅',
  '.el-slider__button-wrapper|z-index':
    '已复核：z-index 由 1001 降到 1，但手柄仍高于轨道（轨道 z-index 为 auto）。' +
    '真机实测手柄中心正好落在轨道起点（x:275 = 轨道起点 293 − 半个手柄宽 18），位置正确 ✅',
  '.el-button|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-color-picker__trigger|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-input-group|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-input-number|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-radio__input|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们（我们在 .el-radio 本身上绑，不在它的子项上绑）',
  '.el-switch__core|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-upload|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-upload-list--picture-card|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-upload-list__item-name|display':
    '不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们',
  '.el-checkbox__inner|z-index':
    '不适用：层级只在组件内部生效，未观测到遮挡（复选框渲染正常）',
  '.el-table__column-resize-proxy|z-index':
    '不适用：列宽拖拽时的临时提示层；本仓库未使用该交互（列宽走属性面板）',
  '.el-tabs__nav|z-index':
    '不适用：标签导航层级变化未观测到影响（真机实测 2 个标签项同行渲染正常）',
  '.el-alert__content|display':
    '不适用：新增「提示」物料带进来的差异（EP 把 .el-alert__content 从 table-cell 改成 flex）。' +
    '我们只在 ElAlert 上透传属性，没有在它的子项上绑 display。真机实测提示条渲染正常' +
    '（el-alert--info is-center is-light、标题为默认文案、关闭按钮存在、空描述不渲染）',
  '.el-alert|display':
    '不适用：同上。参考实现的 alert 是扩展字段示例，我们按它的 alertSchema.options 逐项对齐默认值',
}

export interface UpstreamDiffReport {
  elementUiCss: string
  elementPlusCss: string
  /** 物料用到的根选择器 */
  usedRoots: string[]
  /** 参与比对的选择器数量 */
  comparedSelectors: number
  divergences: Divergence[]
  /** 命中 CRITICAL_CONTAINERS 的语义变化（会被测试拦截） */
  critical: Divergence[]
  summary: Record<DivergenceLevel, number>
  markdown: string
}

/** 把老式厂商前缀写法归一，避免把"前缀现代化"误报成行为变化 */
function normalizeDisplay(value: string): string {
  return value
    .replace(/-webkit-box/g, 'flex')
    .replace(/-webkit-flex/g, 'flex')
    .replace(/-ms-flexbox/g, 'flex')
    .replace(/-webkit-inline-box/g, 'inline-flex')
    .replace(/-ms-inline-flexbox/g, 'inline-flex')
}

/** 该 display 变化是否会把子项的 display 块化 */
function isFlexifying(oldValue: string, newValue: string): boolean {
  if (!/flex/.test(newValue)) return false
  if (/flex/.test(normalizeDisplay(oldValue))) return false
  return /(^|[-\s])(inline-block|block|inline|inline-table|table-cell)$/.test(oldValue.trim())
}

function classify(prop: LayoutProp, oldValue: string, newValue: string): DivergenceLevel {
  if (prop === 'display') {
    if (normalizeDisplay(oldValue) === normalizeDisplay(newValue)) return 'prefix'
    return isFlexifying(oldValue, newValue) ? 'semantic' : 'layout'
  }
  return normalizeDisplay(oldValue) === normalizeDisplay(newValue) ? 'prefix' : 'layout'
}

/**
 * 收集 CSS 自定义属性（`--el-index-top: 1000` 之类）。
 *
 * Element Plus 大量用 `calc(var(--el-index-top) + 1)` 表达层级，
 * 而 Element UI 写的是字面量。不求值就会把它们全报成"差异"——
 * 实测 `.el-select-dropdown` 两边都是 **1001**，纯属 token 化，是误报。
 */
export function collectCssVariables(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const re = /(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(css)) !== null) {
    const name = match[1]
    const value = match[2].trim()
    // 后出现的覆盖先出现的（与层叠一致）
    if (!value.includes('var(') || !vars.has(name)) vars.set(name, value)
  }
  return vars
}

/** 只支持 `+` / `-` 与数字的极简求值（够覆盖 token 化的层级/尺寸），不使用 eval */
function evalSimpleExpr(expr: string): number | undefined {
  const compact = expr.replace(/\s+/g, '')
  const tokens = compact.match(/[+-]?[\d.]+/g)
  if (!tokens || tokens.join('') !== compact) return undefined
  return tokens.reduce((sum, token) => sum + Number(token), 0)
}

/** 把 `var(--x)` 与 `calc(...)` 尽量求成字面量；求不出来就原样返回 */
export function resolveCssValue(raw: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 6) return raw
  let out = raw.replace(
    /var\((--[a-z0-9-]+)\s*(?:,\s*([^)]*))?\)/gi,
    (_full, name: string, fallback?: string) => {
      const found = vars.get(name)
      if (found !== undefined) return resolveCssValue(found, vars, depth + 1)
      return fallback ? resolveCssValue(fallback, vars, depth + 1) : ''
    },
  )
  const calc = /^calc\((.*)\)$/i.exec(out.trim())
  if (calc) {
    const value = evalSimpleExpr(calc[1])
    if (value !== undefined) out = String(value)
  }
  return out.trim()
}

/**
 * 极简 CSS 解析：选择器 → 属性表。
 *
 * 局限（已知，够用即可）：
 * - 不处理嵌套的 `@media`：内部规则会被单独匹配到，于是媒体查询里的覆盖值会参与比对，
 *   可能对"只在窄屏下才变"的属性产生误报。当前两份 CSS 在布局关键属性上没有这种差异。
 * - 只保留"最后一个值"，与层叠顺序一致。
 */
export function parseLayoutDeclarations(
  css: string,
  vars: Map<string, string> = new Map(),
): Map<string, Partial<Record<LayoutProp, string>>> {
  const result = new Map<string, Partial<Record<LayoutProp, string>>>()
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null

  while ((match = ruleRe.exec(css)) !== null) {
    const body = match[2]
    const decl: Partial<Record<LayoutProp, string>> = {}
    let has = false
    for (const prop of LAYOUT_PROPS) {
      const re = new RegExp(`(?<![-\\w])${prop}\\s*:\\s*([^;]+)`)
      const found = re.exec(body)
      if (found) {
        decl[prop] = resolveCssValue(found[1].trim(), vars)
        has = true
      }
    }
    if (!has) continue

    for (const rawSelector of match[1].split(',')) {
      const selector = rawSelector.trim()
      // 只收单类、无后代/伪类/子选择器的规则：这类最容易判定归属，也最少噪音
      if (!selector.startsWith('.el-')) continue
      if (/[\s:>+~[]/.test(selector.slice(1))) continue
      result.set(selector, { ...(result.get(selector) ?? {}), ...decl })
    }
  }
  return result
}

/**
 * 从物料 SFC 里收集**实际用到的** Element Plus 根选择器。
 *
 * 规则：`import { ElInput } from 'element-plus'` → `.el-input`。
 * 另外把源码里显式写过的 `.el-*` 字符串也收进来（例如 `:deep(.el-radio-group)`），
 * 因为我们自己写过的选择器一定是关心的。
 */
export function collectUsedRoots(componentFiles: Array<{ path: string; source: string }>): Set<string> {
  const roots = new Set<string>()
  for (const { source } of componentFiles) {
    const importRe = /import\s*\{([^}]+)\}\s*from\s*'element-plus'/g
    let match: RegExpExecArray | null
    while ((match = importRe.exec(source)) !== null) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim()
        if (!name.startsWith('El')) continue
        const kebab = name
          .slice(2)
          .replace(/(?<!^)(?=[A-Z])/g, '-')
          .toLowerCase()
        roots.add(`.el-${kebab}`)
      }
    }
    // 源码里显式出现的 .el-* 类名
    const classRe = /\.el-[a-z0-9-]+/g
    while ((match = classRe.exec(source)) !== null) {
      roots.add(match[0])
    }
  }
  return roots
}

/**
 * 某个选择器是否属于某个已使用的根。
 * 既匹配根本身，也匹配其子元素/修饰符（`.el-input` → `.el-input-group__append`）。
 */
function belongsTo(selector: string, roots: Set<string>): string | undefined {
  if (roots.has(selector)) return selector
  let best: string | undefined
  for (const root of roots) {
    if (selector.startsWith(`${root}-`) || selector.startsWith(`${root}__`)) {
      if (!best || root.length > best.length) best = root
    }
  }
  return best
}

/**
 * 向上查找文件，找不到返回 undefined。
 *
 * ⚠️ 每一层都要同时看 `<dir>/<rel>` 与 `<dir>/node_modules/<rel>`：
 * pnpm 把依赖装在各个包的 `node_modules` 下，只查前者会永远找不到
 * （表现为审计静默跳过——比报错更危险）。
 */
function findUp(relativePath: string, startDir: string): string | undefined {
  let dir = resolve(startDir)
  for (let i = 0; i < 12; i += 1) {
    for (const candidate of [join(dir, relativePath), join(dir, 'node_modules', relativePath)]) {
      if (existsSync(candidate)) return candidate
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/** 本仓库的 Element Plus 样式（dist 聚合产物） */
export function resolveElementPlusCss(startDir: string): string | undefined {
  return findUp(join('element-plus', 'dist', 'index.css'), startDir)
}

/**
 * 参考实现的 Element UI 样式。
 * `referenceSrcDir` 指向 `variant-form/src`，Element UI 装在其上一级的 node_modules 里。
 */
export function resolveElementUiCss(referenceSrcDir: string): string | undefined {
  const projectRoot = resolve(referenceSrcDir, '..')
  const direct = join(projectRoot, 'node_modules', 'element-ui', 'packages', 'theme-chalk', 'lib', 'index.css')
  if (existsSync(direct)) return direct
  return findUp(join('element-ui', 'packages', 'theme-chalk', 'lib', 'index.css'), referenceSrcDir)
}

export interface BuildUpstreamDiffOptions {
  elementUiCss: string
  elementPlusCss: string
  componentFiles: Array<{ path: string; source: string }>
}

export function buildUpstreamDiffReport(options: BuildUpstreamDiffOptions): UpstreamDiffReport {
  const uiCss = readFileSync(options.elementUiCss, 'utf8')
  const plusCss = readFileSync(options.elementPlusCss, 'utf8')
  // 两边都收集变量：EP 用 CSS 变量表达层级，EU 偶有局部变量
  const uiVars = collectCssVariables(uiCss)
  const plusVars = collectCssVariables(plusCss)
  const ui = parseLayoutDeclarations(uiCss, uiVars)
  const plus = parseLayoutDeclarations(plusCss, plusVars)
  const roots = collectUsedRoots(options.componentFiles)

  const divergences: Divergence[] = []
  let compared = 0

  const selectors = [...plus.keys()].sort()
  for (const selector of selectors) {
    const root = belongsTo(selector, roots)
    if (!root) continue
    const next = plus.get(selector)
    const prev = ui.get(selector)
    // 参考实现里没有这条规则 → 属于"新增样式"，不在本审计范围（见文档说明）
    if (!prev || !next) continue
    compared += 1

    for (const prop of LAYOUT_PROPS) {
      const a = prev[prop]
      const b = next[prop]
      if (a === undefined || b === undefined || a === b) continue
      divergences.push({
        selector,
        root,
        prop,
        elementUi: a,
        elementPlus: b,
        level: classify(prop, a, b),
      })
    }
  }

  const summary: Record<DivergenceLevel, number> = { semantic: 0, layout: 0, prefix: 0 }
  for (const d of divergences) summary[d.level] += 1

  const criticalSelectors = new Set(CRITICAL_CONTAINERS.map((c) => c.selector))
  const critical = divergences.filter(
    (d) => d.level === 'semantic' && criticalSelectors.has(d.selector),
  )

  return {
    elementUiCss: options.elementUiCss,
    elementPlusCss: options.elementPlusCss,
    usedRoots: [...roots].sort(),
    comparedSelectors: compared,
    divergences,
    critical,
    summary,
    markdown: renderMarkdown({
      divergences,
      summary,
      roots,
      compared,
      criticalSelectors,
      reviewed: new Map(Object.entries(REVIEWED_DIVERGENCES)),
    }),
  }
}

const LEVEL_LABEL: Record<DivergenceLevel, string> = {
  semantic: '🔴 语义变化',
  layout: '🟠 布局差异',
  prefix: '⚪ 前缀噪音',
}

const LEVEL_NOTE: Record<DivergenceLevel, string> = {
  semantic:
    '容器从 block/inline-block 变成 flex —— 子项的 `display` 会被 CSS 规范「块化」（`inline` → `block`），' +
    '凡是在子项上绑 `display` 的实现都会静默失效（radio 的 `displayStyle` 就是这么坏的）',
  layout: 'position / z-index / overflow / flex 容器属性等发生变化',
  prefix: '只是 -webkit-box / -webkit-flex 之类的前缀现代化，无行为差异，可忽略',
}

function renderMarkdown(input: {
  divergences: Divergence[]
  summary: Record<DivergenceLevel, number>
  roots: Set<string>
  compared: number
  criticalSelectors: Set<string>
  reviewed: Map<string, string>
}): string {
  const { divergences, summary, roots, compared, criticalSelectors, reviewed } = input
  const lines: string[] = []

  lines.push('# 上游样式差异报告（Element UI → Element Plus）')
  lines.push('')
  lines.push('> 由 `pnpm --filter @lowcode/materials test` 自动生成，请勿手工编辑。')
  lines.push('>')
  lines.push('> 覆盖的是现有 `conformance` 审计**够不到**的那一层：props / events 之外的')
  lines.push('> **上游 CSS 语义变化**。这类问题静态审计看不见、happy-dom（无布局引擎）测不到、')
  lines.push('> 单测断言 inline style 字符串也测不到，只能靠机械比对或真机复核。')
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 指标 | 数值 |')
  lines.push('| --- | --- |')
  lines.push(`| 物料用到的根选择器 | ${roots.size} |`)
  lines.push(`| 两边都有、参与比对的选择器 | ${compared} |`)
  lines.push(`| 🔴 语义变化 | ${summary.semantic} |`)
  lines.push(`| 🟠 布局差异 | ${summary.layout} |`)
  lines.push(`| ⚪ 前缀噪音 | ${summary.prefix} |`)
  lines.push(`| ⛔ 其中**会让我们失效**的（见下） | ${divergences.filter((d) => d.level === 'semantic' && criticalSelectors.has(d.selector)).length} |`)
  lines.push(`| ✅ 已复核（有结论，见下） | ${divergences.filter((d) => reviewed.has(`${d.selector}|${d.prop}`)).length} |`)
  lines.push(`| ⬜ 尚未复核 | ${divergences.filter((d) => d.level !== 'prefix' && !reviewed.has(`${d.selector}|${d.prop}`)).length} |`)
  lines.push('')
  lines.push('## 判定口径')
  lines.push('')
  lines.push('"上游把某元素的 display 改成 flex"**本身不是 bug**，必须叠加"我们在它的子项上绑了 `display`"')
  lines.push('才成立——那时子项成了 flex item，`display` 被块化（`inline` → `block`），我们的绑定静默失效。')
  lines.push('')
  lines.push('因此分两层：')
  lines.push('')
  lines.push('- **⛔ 会让我们失效**：命中下列容器的语义变化，**测试会强制拦截**（必须修或登记 `CSS_WAIVERS`）')
  for (const c of CRITICAL_CONTAINERS) {
    lines.push(`  - \`${c.selector}\` —— ${c.note}`)
  }
  lines.push('- **🔴 其余语义变化**：只进报告供人工判断，多半与我们无关（我们没在它们的子项上绑 display）')
  lines.push('')

  for (const level of ['semantic', 'layout', 'prefix'] as DivergenceLevel[]) {
    const rows = divergences.filter((d) => d.level === level)
    if (rows.length === 0) continue
    lines.push(`## ${LEVEL_LABEL[level]}（${rows.length}）`)
    lines.push('')
    lines.push(`> ${LEVEL_NOTE[level]}`)
    lines.push('')
    if (level === 'prefix') {
      lines.push(`<details><summary>展开（${rows.length} 条，无需处理）</summary>`)
      lines.push('')
    }
    lines.push('| 选择器 | 属性 | Element UI | Element Plus | 归属根 | 状态 |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const d of rows) {
      const key = `${d.selector}|${d.prop}`
      const state =
        d.level === 'semantic' && criticalSelectors.has(d.selector)
          ? '⛔ 会让我们失效'
          : reviewed.has(key)
            ? '✅ 已复核'
            : d.level === 'prefix'
              ? '—'
              : '⬜ 待复核'
      lines.push(
        `| \`${d.selector}\` | ${d.prop} | \`${d.elementUi}\` | \`${d.elementPlus}\` | \`${d.root}\` | ${state} |`,
      )
    }
    lines.push('')
    if (level === 'prefix') {
      lines.push('</details>')
      lines.push('')
    }
  }

  lines.push('## 怎么用这份报告')
  lines.push('')
  lines.push('1. **⛔ 会让我们失效**：必须处理——把容器语义恢复成 Element UI 的取值，')
  lines.push('   或登记 `CSS_WAIVERS` 说明为什么不影响。已修的案例见')
  lines.push('   `packages/materials/src/components/Radio.vue` 的 `<style>` 块。')
  lines.push('2. **🔴 其余语义变化**：逐条问一句"我们在它的子项上绑 display 了吗"。没有就跳过；')
  lines.push('   拿不准的用真机复核（`scripts/cdp-inspect.mjs`，方法见 `docs/interaction-spec/README.md` 7.8）。')
  lines.push('3. **🟠 布局差异**：`z-index` 影响浮层遮挡，`position` 影响下拉/面板定位，值得逐条看。')
  lines.push('4. **⚪ 前缀噪音**不用管。')
  lines.push('')
  lines.push('## 已复核结论')
  lines.push('')
  lines.push('只列**实际复核过**的条目（真机取证或代码核对）。未列出的非致命差异仍未复核——')
  lines.push('它们不参与拦截，需要时按上面的口径逐条判断。')
  lines.push('')
  lines.push('| 选择器 | 属性 | 结论 |')
  lines.push('| --- | --- | --- |')
  for (const [key, conclusion] of Object.entries(REVIEWED_DIVERGENCES)) {
    const [selector, prop] = key.split('|')
    lines.push(`| \`${selector}\` | ${prop} | ${conclusion} |`)
  }
  lines.push('')
  lines.push('真机取证方法：`scripts/cdp-inspect.mjs`（见 `docs/interaction-spec/README.md` 7.8）。')
  lines.push('')
  lines.push('## 已知局限')
  lines.push('')
  lines.push('- 只比对**两边都有**的选择器；Element Plus 新增的规则不在范围内')
  lines.push('  （新增通常表现为"多了一层 wrapper"，需要真机看）。')
  lines.push('- 解析器不处理 `@media` 嵌套：媒体查询里的覆盖值会参与比对，可能产生误报。')
  lines.push('- 只覆盖布局关键属性；颜色/圆角/字号等视觉细节不在范围。')
  lines.push('- `CRITICAL_CONTAINERS` 是**手工登记**的：新增在子项上绑 display 的组件时，')
  lines.push('  必须同步登记，否则该组件不会被拦截。')
  lines.push('')
  return lines.join('\n')
}
