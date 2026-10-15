import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, resolveReferenceDir } from './reference-spec'
import {
  buildUpstreamDiffReport,
  collectUsedRoots,
  parseLayoutDeclarations,
  resolveElementPlusCss,
  resolveElementUiCss,
  type Divergence,
  type UpstreamDiffReport,
} from './upstream-css'

const componentsDir = join(REPO_ROOT, 'packages/materials/src/components')

/**
 * 已确认的上游样式差异。
 *
 * 与 `audit.ts` 的 `WAIVERS` 同一范式：**每条都必须给出结论与依据**，
 * 登记一条等于承认"这里和参考实现不同，且我们知道原因"。
 * 未登记的 🔴 语义变化会让测试失败——不允许悄悄漂移。
 */
export interface CssWaiver {
  selector: string
  prop: string
  reason: string
}

export const CSS_WAIVERS: CssWaiver[] = [
  {
    selector: '.el-radio-group',
    prop: 'display',
    reason:
      'EP 把容器从 inline-block 改成 inline-flex，会使选项的 display 被「块化」，' +
      '导致 radio 的 displayStyle 静默失效。已在 Radio.vue 用 :deep 把容器恢复成 inline-block，' +
      '并用真实 Chrome 验证（displayStyle=block → 3 行；inline → 1 行）',
  },
  {
    selector: '.el-radio',
    prop: 'display',
    reason:
      '同上：容器已恢复为非 flex，因此 .el-radio 自身的 inline-block → inline-flex 不再影响' +
      '我们绑在它上面的 display（实测 computed 值与预期一致）',
  },
]

function loadComponentFiles(): Array<{ path: string; source: string }> {
  return readdirSync(componentsDir)
    .filter((name) => name.endsWith('.vue'))
    .map((name) => ({ path: join(componentsDir, name), source: readFileSync(join(componentsDir, name), 'utf8') }))
}

describe('上游样式抽取器（纯函数）', () => {
  it('抽取布局关键属性', () => {
    const parsed = parseLayoutDeclarations(`.el-x { display: inline-block; color: red } .el-y { z-index: 10 }`)
    expect(parsed.get('.el-x')).toEqual({ display: 'inline-block' })
    expect(parsed.get('.el-y')).toEqual({ 'z-index': '10' })
  })

  it('忽略带后代/伪类/子选择器的规则（避免归属误判）', () => {
    const parsed = parseLayoutDeclarations(`.el-x .el-y { display: flex } .el-a:hover { display: block }`)
    expect(parsed.size).toBe(0)
  })

  it('从 import 与源码里的类名收集用到的根选择器', () => {
    const roots = collectUsedRoots([
      { path: 'a.vue', source: `import { ElInput, ElRadioGroup } from 'element-plus'` },
      { path: 'b.vue', source: `.lc-x :deep(.el-select-group) { display: block }` },
    ])
    expect(roots.has('.el-input')).toBe(true)
    expect(roots.has('.el-radio-group')).toBe(true)
    expect(roots.has('.el-select-group')).toBe(true)
  })
})

const referenceDir = resolveReferenceDir()
const elementUiCss = referenceDir ? resolveElementUiCss(referenceDir) : undefined
const elementPlusCss = resolveElementPlusCss(componentsDir)

describe.skipIf(!elementUiCss || !elementPlusCss)('上游样式差异审计', () => {
  it('生成报告；未登记的语义差异会让本用例失败', () => {
    const report: UpstreamDiffReport = buildUpstreamDiffReport({
      elementUiCss: elementUiCss!,
      elementPlusCss: elementPlusCss!,
      componentFiles: loadComponentFiles(),
    })

    writeFileSync(join(REPO_ROOT, 'docs/upstream-diff-report.md'), report.markdown, 'utf8')
    writeFileSync(
      join(REPO_ROOT, 'docs/upstream-diff-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )

    // 抽到东西了才说明解析器真的在工作（防止两份 CSS 路径错了却"零差异通过"）
    expect(report.usedRoots.length).toBeGreaterThan(0)
    expect(report.comparedSelectors).toBeGreaterThan(0)

    // 只拦截**会让我们失效**的那一类（我们在其子项上绑了 display 的容器）。
    // 其余语义变化只进报告供人工判断——"上游把某元素改成 flex"本身不是 bug。
    const waived = new Set(CSS_WAIVERS.map((w) => `${w.selector}|${w.prop}`))
    const unwaived = report.critical
      .filter((d: Divergence) => !waived.has(`${d.selector}|${d.prop}`))
      .map((d) => `${d.selector} ${d.prop}: ${d.elementUi} → ${d.elementPlus}`)

    expect(
      unwaived,
      '存在未登记的 ⛔ 致命语义变化（会让绑在子项上的 display 失效）：' +
        '请修复，或登记到 CSS_WAIVERS 并写明为什么不影响',
    ).toEqual([])
  })
})
