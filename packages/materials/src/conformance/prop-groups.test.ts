import { describe, expect, it } from 'vitest'
import { MATERIAL_MANIFESTS } from '../manifest'
import { auditPropGroups } from './prop-groups'
import {
  loadReferencePropertyGroups,
  loadReferenceSpec,
  parseReferencePropertyGroups,
  resolveReferenceDir,
} from './reference-spec'

const referenceDir = resolveReferenceDir()

describe('参考属性分组解析器', () => {
  it('解析 COMMON / ADVANCED / EVENT 三张注册表', () => {
    const groups = parseReferencePropertyGroups(`
const COMMON_PROPERTIES = {
  //字段
  'name'              :            'name-editor',
  'size'              :            'size-editor',

  //容器
  'gutter'            :            'gutter-editor',
}

const ADVANCED_PROPERTIES = {
  'min'               :            'min-editor',
  'labelIconClass'    :            'labelIconClass-editor',
}

const EVENT_PROPERTIES = {
  'onCreated'         :            'onCreated-editor',
  'onClick'           :            'onClick-editor',
}
`)

    expect(groups.common).toEqual(['name', 'size', 'gutter'])
    expect(groups.advanced).toEqual(['min', 'labelIconClass'])
    expect(groups.event).toEqual(['onCreated', 'onClick'])
    expect(groups.groupOf).toMatchObject({
      name: 'common',
      gutter: 'common',
      min: 'advanced',
      labelIconClass: 'advanced',
      onClick: 'event',
    })
  })

  it('缺少注册表时返回空结构', () => {
    const groups = parseReferencePropertyGroups('')
    expect(groups.common).toEqual([])
    expect(groups.advanced).toEqual([])
    expect(groups.event).toEqual([])
    expect(groups.groupOf).toEqual({})
  })
})

describe.skipIf(!referenceDir)('属性分组与参考实现对齐', () => {
  it('每个参考 widget 的属性 / 事件都落在参考的同一分组', async () => {
    const reference = await loadReferenceSpec(referenceDir!)

    // 参考目录必须能解析出三张注册表，否则本用例会静默空转
    expect(loadReferencePropertyGroups(referenceDir!)).toBeDefined()
    expect(reference.propertyGroups?.advanced.length).toBeGreaterThan(20)

    const audit = auditPropGroups(reference, MATERIAL_MANIFESTS)

    expect(audit.checkedWidgets).toBeGreaterThanOrEqual(28)
    expect(
      audit.mismatches.map(
        (item) => `${item.widget}.${item.prop}（参考 ${item.expected} / 实际 ${item.actual}）`,
      ),
      '高级设置 / 通用设置的归属必须与参考的 ADVANCED_PROPERTIES / COMMON_PROPERTIES 一致',
    ).toEqual([])
    expect(
      audit.events.map((item) => `${item.widget}.${item.event}（${item.kind}）`),
      '事件设置必须与参考的事件属性一一对应',
    ).toEqual([])
  })

  it('字段类通用项不再出现在高级设置里', async () => {
    const reference = await loadReferenceSpec(referenceDir!)
    const groups = reference.propertyGroups!
    const byType = new Map(MATERIAL_MANIFESTS.map((material) => [material.type, material]))

    // 参考里明确属于「基础」的字段属性
    const commonOptions = [
      'labelAlign',
      'columnWidth',
      'size',
      'labelWidth',
      'labelHidden',
      'validation',
      'validationHint',
      'readonly',
      'disabled',
      'clearable',
    ]
    for (const option of commonOptions) {
      expect(groups.groupOf[option]).toBe('common')
    }

    for (const type of ['input', 'textarea', 'number', 'select', 'date', 'switch', 'rate']) {
      const material = byType.get(type)!
      for (const config of material.propConfigs) {
        if (!['validation', 'validationHint', 'size', 'labelWidth', 'labelHidden', 'labelAlign', 'columnWidth', 'readonly', 'disabled', 'clearable'].includes(config.name)) continue
        expect(config.group, `${type}.${config.name} 不应在高级设置`).toBe('common')
      }
    }
  })

  it('参考的高级属性全部落在高级设置里', async () => {
    const reference = await loadReferenceSpec(referenceDir!)
    const groups = reference.propertyGroups!
    const byType = new Map(MATERIAL_MANIFESTS.map((material) => [material.type, material]))

    // 参考 ADVANCED_PROPERTIES 的字段类代表项
    const expectations: Record<string, string[]> = {
      input: ['minLength', 'maxLength', 'showWordLimit', 'prefixIcon', 'suffixIcon', 'appendButton', 'appendButtonDisabled', 'buttonIcon'],
      number: ['min', 'max', 'precision', 'step', 'controlsPosition'],
      slider: ['min', 'max', 'step', 'range', 'vertical'],
      switch: ['switchWidth', 'activeText', 'inactiveText', 'activeColor', 'inactiveColor'],
      rate: ['max', 'lowThreshold', 'highThreshold', 'allowHalf', 'showText', 'showScore'],
      button: ['plain', 'round', 'circle', 'icon'],
      textarea: ['minLength', 'maxLength', 'showWordLimit'],
    }

    for (const [type, props] of Object.entries(expectations)) {
      const material = byType.get(type)!
      for (const prop of props) {
        expect(groups.groupOf[prop], `${prop} 在参考里应属于高级`).toBe('advanced')
        const config = material.propConfigs.find((item) => item.name === prop)
        expect(config, `${type}.${prop} 缺少面板项`).toBeDefined()
        expect(config!.group, `${type}.${prop} 应在高级设置`).toBe('advanced')
      }
    }

    // 标签图标类：参考的 ADVANCED_PROPERTIES 里也有
    for (const prop of ['labelIconClass', 'labelIconPosition', 'labelTooltip']) {
      expect(groups.groupOf[prop]).toBe('advanced')
    }
  })
})
