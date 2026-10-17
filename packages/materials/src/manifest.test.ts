import { describe, expect, it } from 'vitest'
import type { PropGroup } from '@lowcode/schema'
import { MATERIAL_MANIFESTS } from './manifest'

/**
 * 期望覆盖的组件类型：参考 variant-form 组件库的 28 个 widget。
 *
 * 表格相关：参考的 `table`（布局表格）/ `table-cell` 已对齐同名；
 * `table-row` 是本平台补充的**行容器**——参考里行不是节点（内嵌在 table 的 rows 数据里），
 * 我们把它做成了节点，所以多这一个类型。
 */
const REFERENCE_WIDGET_TYPES = [
  // 容器
  'grid',
  'table',
  'tab',
  'grid-col',
  'table-row',
  'table-cell',
  'tab-pane',
  // 基础字段
  'input',
  'textarea',
  'number',
  'radio',
  'checkbox',
  'select',
  'time',
  'time-range',
  'date',
  'date-range',
  'switch',
  'rate',
  'color',
  'slider',
  'static-text',
  'html-text',
  'button',
  'divider',
  // 高级字段
  'picture-upload',
  'file-upload',
  'rich-editor',
  'cascader',
] as const

const SUPPORTED_CONTROLS = new Set([
  'input',
  'textarea',
  'number',
  'select',
  'switch',
  'color',
  'radio',
  'radio-button',
  'checkbox',
  'name',
  'label',
  'hidden',
  'style',
  'custom-class',
  'expression',
  'event',
  'events',
  'option-items',
  'structure',
  'json',
  'code',
  'monaco',
  'slots',
])

const STRUCTURE_EDITORS = new Set(['grid-columns', 'table-structure', 'tab-panes'])

const GROUPS: PropGroup[] = ['common', 'advanced', 'event']

const byId = new Map(MATERIAL_MANIFESTS.map((material) => [material.type, material]))

describe('物料清单完整性', () => {
  it('包含参考组件库的全部组件类型', () => {
    const missing = REFERENCE_WIDGET_TYPES.filter((type) => !byId.has(type))
    expect(missing).toEqual([])
  })

  it('物料类型唯一且具备基础元信息', () => {
    expect(byId.size).toBe(MATERIAL_MANIFESTS.length)
    for (const material of MATERIAL_MANIFESTS) {
      expect(material.type).toMatch(/^[a-z][\w-]*$/)
      expect(material.name.length).toBeGreaterThan(0)
      expect(material.category.length).toBeGreaterThan(0)
      expect(material.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(material.propConfigs.length).toBeGreaterThan(0)
      expect(typeof material.defaultProps).toBe('object')
    }
  })

  it('属性面板控件类型均受支持，structure 控件声明了已知编辑器', () => {
    for (const material of MATERIAL_MANIFESTS) {
      for (const config of material.propConfigs) {
        expect(
          SUPPORTED_CONTROLS.has(config.control),
          `${material.type}.${config.name} 使用了未知控件 ${config.control}`,
        ).toBe(true)
        if (config.control === 'structure') {
          expect(
            STRUCTURE_EDITORS.has(config.editor ?? ''),
            `${material.type}.${config.name} 缺少已知 structure 编辑器`,
          ).toBe(true)
        }
      }
    }
  })

  it('属性名在同一物料内唯一', () => {
    for (const material of MATERIAL_MANIFESTS) {
      const names = material.propConfigs.map((config) => config.name)
      expect(new Set(names).size, `${material.type} 存在重复属性`).toBe(names.length)
    }
  })

  it('visibleWhen 依赖的属性确实存在（防联动条件写错）', () => {
    for (const material of MATERIAL_MANIFESTS) {
      const names = new Set(material.propConfigs.map((config) => config.name))
      for (const config of material.propConfigs) {
        const dependency = config.visibleWhen?.prop
        if (!dependency) continue
        expect(
          names.has(dependency),
          `${material.type}.${config.name} 联动了不存在的属性 ${dependency}`,
        ).toBe(true)
      }
    }
  })

  it('每个物料至少有一个通用设置项', () => {
    for (const material of MATERIAL_MANIFESTS) {
      const common = material.propConfigs.filter((config) => (config.group ?? 'common') === 'common')
      expect(common.length, `${material.type} 缺少通用设置项`).toBeGreaterThan(0)
    }
  })

  it('属性分组取值合法', () => {
    for (const material of MATERIAL_MANIFESTS) {
      for (const config of material.propConfigs) {
        if (!config.group) continue
        expect(GROUPS, `${material.type}.${config.name} 分组非法`).toContain(config.group)
      }
    }
  })

  it('select / radio / checkbox 控件必须声明 options', () => {
    for (const material of MATERIAL_MANIFESTS) {
      for (const config of material.propConfigs) {
        if (!['select', 'radio', 'radio-button', 'checkbox'].includes(config.control)) continue
        expect(
          (config.options ?? []).length,
          `${material.type}.${config.name} 缺少 options`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('事件名是 camelCase 标识符且不重复', () => {
    for (const material of MATERIAL_MANIFESTS) {
      const names = (material.events ?? []).map((event) => event.name)
      expect(new Set(names).size, `${material.type} 事件重复`).toBe(names.length)
      for (const name of names) {
        expect(name, `${material.type} 事件名 ${name} 非法`).toMatch(/^[a-z][A-Za-z0-9]*$/)
      }
    }
  })

  it('defaultChildren 引用的物料必须存在且为内部物料', () => {
    for (const material of MATERIAL_MANIFESTS) {
      for (const spec of material.defaultChildren ?? []) {
        const child = byId.get(spec.type)
        expect(child, `${material.type} 引用了未声明的子结构 ${spec.type}`).toBeDefined()
      }
    }
  })

  it('隐藏物料要么是内部结构、要么是兼容用的旧版物料', () => {
    const structural = new Set(
      MATERIAL_MANIFESTS.flatMap((material) =>
        (material.defaultChildren ?? []).map((spec) => spec.type),
      ),
    )
    const legacy = new Set(['text'])
    for (const material of MATERIAL_MANIFESTS) {
      if (!material.hidden) continue
      expect(
        structural.has(material.type) || legacy.has(material.type),
        `${material.type} 被隐藏但没有被任何容器使用`,
      ).toBe(true)
    }
  })

  it('容器类物料声明了 slots 或 defaultChildren', () => {
    for (const material of MATERIAL_MANIFESTS) {
      if (!material.droppable && !material.defaultChildren) continue
      expect(material.slots ?? []).toContain('default')
    }
  })
})

describe('属性面板完整性', () => {
  it('每个可配置属性都要有属性面板配置项（否则用户改不了）', () => {
    /**
     * ⚠️ 这条守卫的由来：属性面板 A/B 发现「单行输入」参考暴露 32 项组件属性、
     * 我们只有 25 项——差别不只是改名，还有**我们自己有 prop 却没有面板项**的：
     * `showWordLimit` / `labelIconPosition` / `appendButtonDisabled` / `buttonIcon`。
     * 即"能力在、入口不在"，用户根本改不到。
     *
     * 这里把"能力有、入口没有"变成编译期就能发现的问题。
     */
    const SYSTEM_PROPS = new Set(['name', 'hidden', 'modelValue'])
    const missing: string[] = []
    for (const material of MATERIAL_MANIFESTS) {
      if (material.hidden) continue
      const configured = new Set((material.propConfigs ?? []).map((c) => c.name))
      for (const key of Object.keys(material.defaultProps ?? {})) {
        if (SYSTEM_PROPS.has(key)) continue
        if (!configured.has(key)) missing.push(`${material.name}(${material.type}).${key}`)
      }
    }
    expect(missing, '这些属性可以设值但没有属性面板入口，用户改不到').toEqual([])
  })
})
