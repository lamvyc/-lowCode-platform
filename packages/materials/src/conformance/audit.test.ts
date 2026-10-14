import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MATERIAL_MANIFESTS } from '../manifest'
import {
  buildConformanceReport,
  loadMaterialComponentMap,
} from './audit'
import {
  extractComponentBoundAttrs,
  extractComponentName,
  extractDeclaredProps,
} from './component-spec'
import {
  extractBoundAttrs,
  extractDomEvents,
  extractUsedOptions,
  normalizeTag,
  REPO_ROOT,
  resolveReferenceDir,
} from './reference-spec'

const referenceDir = resolveReferenceDir()
const componentsDir = join(REPO_ROOT, 'packages/materials/src/components')

describe('规格抽取器（纯函数）', () => {
  it('抽取选项读取：field.options.X / widget.options.X', () => {
    const source = `
      <el-input :disabled="field.options.disabled" :clearable="field.options.clearable" />
      <el-row :gutter="widget.options.gutter" :class="field.options.customClass" />
      <span>{{ field.options.label }}</span>
    `
    expect(extractUsedOptions(source).sort()).toEqual([
      'clearable',
      'customClass',
      'disabled',
      'gutter',
      'label',
    ])
  })

  it('抽取 UI 属性绑定（标签归一化 + 只取 options 来源）', () => {
    const source = `
      <el-radio-group v-model="fieldModel" :disabled="field.options.disabled">
        <el-radio-button :border="field.options.border" :style="{display: field.options.displayStyle}" />
      </el-radio-group>
      <el-input :placeholder="'固定文本'" />
    `
    expect(extractBoundAttrs(source)).toEqual([
      { tag: 'elradiogroup', attr: 'disabled', option: 'disabled' },
      { tag: 'elradiobutton', attr: 'border', option: 'border' },
      { tag: 'elradiobutton', attr: 'style', option: 'displayStyle' },
    ])
    expect(normalizeTag('El-Input')).toBe('elinput')
  })

  it('抽取模板事件（去掉 .native / .stop 等修饰符）', () => {
    const source = `<el-button @click.native="onClick" @change="onChange" @click.stop="x" />`
    expect(extractDomEvents(source).sort()).toEqual(['change', 'click'])
  })

  it('抽取 defineProps 第一层属性名（忽略嵌套对象与注释）', () => {
    const source = `
      defineOptions({ name: 'LcDemo' })
      const props = withDefaults(
        defineProps<{
          /** 标签 */
          label?: string
          // modelValue: 注释不应被识别
          modelValue?: { nested: string; other: number }
          options?: Array<{ label: string; value: string }>
          required?: boolean
        }>(),
        { label: '', modelValue: undefined, options: () => [], required: false },
      )
    `
    expect(extractDeclaredProps(source)).toEqual(['label', 'modelValue', 'options', 'required'])
    expect(extractComponentName(source)).toBe('LcDemo')
  })

  it('抽取组件模板中的属性绑定表达式', () => {
    const source = `<ElInput :model-value="modelText" :maxlength="maxLength" style="width: 100%" />`
    expect(extractComponentBoundAttrs(source)).toEqual([
      { tag: 'elinput', attr: 'model-value', expression: 'modelText' },
      { tag: 'elinput', attr: 'maxlength', expression: 'maxLength' },
    ])
  })
})

describe('物料清单 ↔ 组件文件映射', () => {
  const componentMap = loadMaterialComponentMap()

  it('每个物料都能解析到组件文件且文件存在', () => {
    const problems: string[] = []
    for (const manifest of MATERIAL_MANIFESTS) {
      const file = componentMap.get(manifest.type)
      if (!file) {
        problems.push(`${manifest.type}: 未在 MATERIAL_COMPONENTS 中注册`)
      } else if (!existsSync(join(componentsDir, file))) {
        problems.push(`${manifest.type}: 组件文件不存在 ${file}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('清单里声明的属性都能在组件 defineProps 中找到（防止属性名写错/漏声明）', () => {
    const problems: string[] = []
    const systemProps = new Set(['name', 'hidden', 'label', 'style', 'class'])
    const structuralProps = new Set(['columns', 'tableStructure', 'panes'])
    // 仅声明、不由组件消费的属性：作为声明式元数据交给表单引擎 / 代码生成
    const declarativeOnlyProps = new Set(['validation'])

    for (const manifest of MATERIAL_MANIFESTS) {
      const file = componentMap.get(manifest.type)
      if (!file) continue
      // 直接读源码，避免引入 .vue 编译依赖
      const declared = new Set(
        extractDeclaredProps(readFileSync(join(componentsDir, file), 'utf8')),
      )
      for (const config of manifest.propConfigs) {
        if (
          systemProps.has(config.name) ||
          structuralProps.has(config.name) ||
          declarativeOnlyProps.has(config.name)
        ) {
          continue
        }
        if (!declared.has(config.name)) {
          problems.push(`${manifest.type}.${config.name}（组件未声明该 prop）`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe.skipIf(!referenceDir)('与参考实现的一致性审计', () => {
  it('无未登记的一致性差异，并生成报告', async () => {
    const { report, markdown } = await buildConformanceReport({
      referenceDir: referenceDir!,
      manifests: MATERIAL_MANIFESTS,
      componentsDir,
    })

    writeFileSync(join(REPO_ROOT, 'docs/conformance-report.md'), markdown, 'utf8')
    writeFileSync(
      join(REPO_ROOT, 'docs/conformance-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )

    const gaps = report.widgets.filter((widget) => widget.status !== 'ok')
    expect(
      gaps.map((widget) => ({
        widget: widget.referenceType,
        options: widget.missingOptions,
        events: widget.missingEvents,
        attrs: widget.missingAttrs,
      })),
      '存在未登记的一致性差异，请补齐实现或登记 WAIVERS（附原因）',
    ).toEqual([])

    expect(report.summary.missingWidgets).toBe(0)
    expect(report.summary.checkedWidgets).toBeGreaterThanOrEqual(28)
  })
})
