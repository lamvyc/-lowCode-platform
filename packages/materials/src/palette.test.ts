import { describe, expect, it } from 'vitest'
import { MATERIAL_ICONS } from './icons'
import { MATERIAL_MANIFESTS } from './manifest'

/**
 * 物料面板结构对齐参考实现（`variant-form`）。
 *
 * 这不是"猜"出来的期望值，而是把参考实现跑起来后用 CDP 实测出来的面板结构
 * （方法见 `docs/palette-diff.md`）。这里把结论固化成断言，防止后续改名/换组/丢图标
 * 时悄悄漂移——静态一致性审计（`conformance/audit.ts`）只覆盖 props/events，
 * 上游样式审计只覆盖 CSS，**两者都看不到面板本身长什么样**。
 */

/** 参考实现的面板：4 个分组、27 个物料 */
const REFERENCE_PALETTE = {
  容器: ['栅格', '表格', '标签页', '卡片'],
  基础字段: [
    '单行输入', '多行输入', '计数器', '单选项', '多选项', '下拉选项',
    '时间', '时间范围', '日期', '日期范围', '开关', '评分',
    '颜色选择器', '滑块', '静态文字', 'HTML', '按钮', '分隔线',
  ],
  高级字段: ['图片', '文件', '富文本', '级联选择'],
  自定义扩展字段: ['提示'],
}

/**
 * 本仓库**有意多出**的物料：参考实现没有对应组件，作为扩展保留。
 * 位置约定：追加在所属分组末尾，这样参考原有的项位置不变。
 */
const INTENTIONAL_EXTRAS: Record<string, string[]> = {
  基础字段: ['图片'], // 展示图片（参考只有上传用的「图片」）
  自定义扩展字段: ['数据表格'],
}

/** 按 manifest 声明顺序还原面板分组（只取面板可见的物料） */
function paletteGroups(): Array<{ group: string; items: string[] }> {
  const groups: Array<{ group: string; items: string[] }> = []
  for (const material of MATERIAL_MANIFESTS) {
    if (material.hidden) continue
    const group = material.category || '其他'
    let bucket = groups.find((g) => g.group === group)
    if (!bucket) {
      bucket = { group, items: [] }
      groups.push(bucket)
    }
    bucket.items.push(material.name)
  }
  return groups
}

describe('物料面板对齐参考实现', () => {
  it('分组名与顺序一致（不含本仓库扩展分组）', () => {
    const actual = paletteGroups().map((g) => g.group)
    expect(actual).toEqual(Object.keys(REFERENCE_PALETTE))
  })

  it('每个分组的成员与顺序一致（参考原有项在前，本仓库扩展项追加在末尾）', () => {
    for (const group of paletteGroups()) {
      const expected = [
        ...(REFERENCE_PALETTE[group.group as keyof typeof REFERENCE_PALETTE] ?? []),
        ...(INTENTIONAL_EXTRAS[group.group] ?? []),
      ]
      expect(group.items, `分组「${group.group}」的成员/顺序与参考实现不一致`).toEqual(expected)
    }
  })

  it('面板可见物料只比参考多出登记在案的扩展项', () => {
    const referenceCount = Object.values(REFERENCE_PALETTE).reduce((n, v) => n + v.length, 0)
    const extrasCount = Object.values(INTENTIONAL_EXTRAS).reduce((n, v) => n + v.length, 0)
    const visible = MATERIAL_MANIFESTS.filter((m) => !m.hidden)
    expect(visible).toHaveLength(referenceCount + extrasCount)
  })

  it('每个可见物料都指向一个真实存在的 SVG 图标', () => {
    const broken = MATERIAL_MANIFESTS.filter((m) => !m.hidden)
      .filter((m) => !m.icon || !MATERIAL_ICONS[m.icon])
      .map((m) => `${m.name}(${m.type}) → icon=${m.icon}`)
    expect(broken, '这些物料的 icon 不是有效的图标键，面板会退化成显示原始值').toEqual([])
  })

  it('图标不写死 fill，颜色交给 CSS（与参考实现一致）', () => {
    const hardcoded = Object.entries(MATERIAL_ICONS)
      .filter(([, icon]) => /fill\s*=/.test(icon.inner))
      .map(([key]) => key)
    expect(hardcoded, '硬编码 fill 会让图标无法跟随文字颜色').toEqual([])
  })

  it('图标统一 1024×1024 视图', () => {
    const odd = Object.entries(MATERIAL_ICONS)
      .filter(([, icon]) => icon.viewBox !== '0 0 1024 1024')
      .map(([key]) => key)
    expect(odd).toEqual([])
  })
})
