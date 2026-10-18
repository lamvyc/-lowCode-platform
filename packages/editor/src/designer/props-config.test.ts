import { describe, expect, it } from 'vitest'
import type { Material, PageNode, PropConfig } from '@lowcode/schema'
import {
  createAction,
  createActionId,
  groupPropConfigs,
  isPropVisible,
  materialPropConfigs,
  propertySchemaToPropsConfigs,
  readPropValue,
  resolvePropGroup,
  toPlainStyle,
  toStyleConfig,
} from './props-config'

function node(props: Record<string, unknown> = {}): PageNode {
  return { id: 'n1', type: 'input', props }
}

function material(patch: Partial<Material> = {}): Material {
  return {
    type: 'input',
    name: '输入框',
    category: '表单',
    version: '1.0.0',
    defaultProps: {},
    propConfigs: [],
    ...patch,
  }
}

describe('属性面板配置解析', () => {
  it('显式 group 优先，事件控件归入 event，其余归入 common', () => {
    expect(resolvePropGroup({ name: 'a', label: 'A', control: 'input' })).toBe('common')
    expect(resolvePropGroup({ name: 'a', label: 'A', control: 'input', group: 'advanced' })).toBe(
      'advanced',
    )
    expect(resolvePropGroup({ name: 'click', label: 'onClick', control: 'event' })).toBe('event')
    expect(resolvePropGroup({ name: 'evts', label: '事件', control: 'events' })).toBe('event')
  })

  it('groupPropConfigs 按 common → advanced → event 排序并过滤空分区', () => {
    const configs: PropConfig[] = [
      { name: 'click', label: 'onClick', control: 'event' },
      { name: 'gap', label: '间距', control: 'number', group: 'advanced' },
      { name: 'text', label: '文本', control: 'input' },
    ]
    const groups = groupPropConfigs(configs)

    expect(groups.map((group) => group.key)).toEqual(['common', 'advanced', 'event'])
    expect(groups[0].configs.map((config) => config.name)).toEqual(['text'])
    expect(groups[2].label).toBe('事件设置')
  })

  it('isPropVisible 支持 equals / in / notEquals 与无条件下可见', () => {
    const target = node({ type: 'textarea', maxlength: 20, multiple: false })

    expect(isPropVisible({ name: 'a', label: 'A', control: 'input' }, target)).toBe(true)
    expect(
      isPropVisible(
        { name: 'rows', label: '行数', control: 'number', visibleWhen: { prop: 'type', equals: 'textarea' } },
        target,
      ),
    ).toBe(true)
    expect(
      isPropVisible(
        { name: 'rows', label: '行数', control: 'number', visibleWhen: { prop: 'type', equals: 'password' } },
        target,
      ),
    ).toBe(false)
    expect(
      isPropVisible(
        { name: 'rows', label: '行数', control: 'number', visibleWhen: { prop: 'type', in: ['text', 'textarea'] } },
        target,
      ),
    ).toBe(true)
    expect(
      isPropVisible(
        { name: 'limit', label: '上限', control: 'number', visibleWhen: { prop: 'maxlength', notEquals: 0 } },
        target,
      ),
    ).toBe(true)
    expect(
      isPropVisible(
        { name: 'limit', label: '上限', control: 'number', visibleWhen: { prop: 'multiple', notEquals: false } },
        target,
      ),
    ).toBe(false)
  })

  it('isPropVisible 在依赖属性缺失时回落到其 defaultValue', () => {
    const target = node({})
    const configs: PropConfig[] = [
      { name: 'maxlength', label: '最大长度', control: 'number', defaultValue: 0 },
      { name: 'showWordLimit', label: '字数统计', control: 'switch' },
    ]
    const dependent: PropConfig = {
      name: 'showWordLimit',
      label: '字数统计',
      control: 'switch',
      visibleWhen: { prop: 'maxlength', notEquals: 0 },
    }

    // 未传 configs：无法得知默认值，undefined !== 0 视为可见
    expect(isPropVisible(dependent, target)).toBe(true)
    // 传入 configs：maxlength 默认 0，联动项应隐藏
    expect(isPropVisible(dependent, target, configs)).toBe(false)
    expect(isPropVisible(dependent, node({ maxlength: 20 }), configs)).toBe(true)
  })

  it('isPropVisible 支持 visibleWhen.device：只展示当前设备档位的属性', () => {
    const target = node({ responsive: true })
    const config: PropConfig = {
      name: 'md',
      label: '栅格宽度(PC)',
      control: 'number',
      visibleWhen: { prop: 'responsive', equals: true, device: ['pc'] },
    }

    expect(isPropVisible(config, target, undefined, 'pc')).toBe(true)
    expect(isPropVisible(config, target, undefined, 'pad')).toBe(false)
    expect(isPropVisible(config, target, undefined, 'h5')).toBe(false)
    // 不传设备档位（旧调用）时不因 device 条件隐藏
    expect(isPropVisible(config, target)).toBe(true)
    // 属性联动条件仍然生效
    expect(isPropVisible(config, node({ responsive: false }), undefined, 'pc')).toBe(false)
  })

  it('readPropValue 在属性缺失时回落到 defaultValue', () => {
    const config: PropConfig = { name: 'maxlength', label: '最大长度', control: 'number', defaultValue: 0 }
    expect(readPropValue(node({}), config)).toBe(0)
    expect(readPropValue(node({ maxlength: 20 }), config)).toBe(20)
    // 显式 undefined 也回落到默认值
    expect(readPropValue(node({ maxlength: undefined }), config)).toBe(0)
  })

  it('materialPropConfigs 优先 propConfigs，缺省回落到 propertySchema', () => {
    const explicit: PropConfig[] = [{ name: 'text', label: '文本', control: 'input' }]
    expect(materialPropConfigs(material({ propConfigs: explicit }))).toBe(explicit)

    const fromSchema = materialPropConfigs(
      material({
        propConfigs: [],
        propertySchema: {
          type: 'object',
          properties: {
            size: { type: 'string', title: '尺寸', enum: ['small', 'large'], default: 'small' },
            visible: { type: 'boolean', title: '可见', 'x-group': 'advanced' },
            count: { type: 'number', title: '数量' },
          },
        },
      }),
    )

    expect(fromSchema.map((config) => config.name)).toEqual(['size', 'visible', 'count'])
    expect(fromSchema[0]).toMatchObject({
      control: 'select',
      label: '尺寸',
      defaultValue: 'small',
      group: 'common',
    })
    expect(fromSchema[0].options).toEqual([
      { label: 'small', value: 'small' },
      { label: 'large', value: 'large' },
    ])
    expect(fromSchema[1]).toMatchObject({ control: 'switch', group: 'advanced' })
    expect(fromSchema[2].control).toBe('number')
  })

  it('propertySchemaToPropsConfigs 对非法输入返回空数组', () => {
    expect(propertySchemaToPropsConfigs(undefined)).toEqual([])
    expect(propertySchemaToPropsConfigs({})).toEqual([])
  })
})

describe('样式配置转换', () => {
  it('toStyleConfig 把裸 CSS 值包装为静态绑定并保留既有绑定', () => {
    const result = toStyleConfig({
      borderRadius: '8px',
      opacity: 0.5,
      color: { type: 'expression', value: '$page.themeColor' },
    })

    expect(result.borderRadius).toEqual({ type: 'static', value: '8px' })
    expect(result.opacity).toEqual({ type: 'static', value: 0.5 })
    expect(result.color).toEqual({ type: 'expression', value: '$page.themeColor' })
  })

  it('toStyleConfig 拒绝非法值类型', () => {
    expect(() => toStyleConfig({ hidden: true })).toThrowError(/hidden/)
  })

  it('toPlainStyle 解包静态绑定且保留表达式绑定', () => {
    const plain = toPlainStyle({
      borderRadius: { type: 'static', value: '8px' },
      color: { type: 'expression', value: '$page.color' },
    })

    expect(plain).toEqual({
      borderRadius: '8px',
      color: { type: 'expression', value: '$page.color' },
    })
  })

  it('toPlainStyle / toStyleConfig 往返一致', () => {
    const source = {
      borderRadius: { type: 'static' as const, value: '8px' },
      marginTop: { type: 'static' as const, value: 4 },
    }
    expect(toStyleConfig(toPlainStyle(source))).toEqual(source)
  })
})

describe('事件动作工具', () => {
  it('createAction 生成带唯一 id 的默认动作', () => {
    const first = createAction()
    const second = createAction('openDialog')

    expect(first.kind).toBe('setProp')
    expect(first.config).toEqual({})
    expect(second.kind).toBe('openDialog')
    expect(first.id).not.toBe(second.id)
    expect(createActionId()).toMatch(/^act_/)
  })
})
