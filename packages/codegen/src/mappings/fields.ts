import { el, text, type TemplateNode } from '../ast'
import type { PageNode } from '@lowcode/schema'
import { bindAttr, boolAttr, staticAttr } from './helpers'
import type { MappingContext, MappingRegistry } from './types'

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionItems(node: PageNode): Array<Record<string, unknown>> {
  return Array.isArray(node.props.optionItems)
    ? (node.props.optionItems as Array<Record<string, unknown>>)
    : []
}

function optionLabel(option: Record<string, unknown>): string {
  return str(option.label ?? option.value)
}

function optionAttrs(option: Record<string, unknown>): Record<string, string | true> {
  const attrs: Record<string, string | true> = {
    ':value': JSON.stringify(option.value),
  }
  if (option.disabled === true) attrs.disabled = true
  return attrs
}

/** 输入框公共属性 */
function inputAttrs(node: PageNode): Record<string, string | true> {
  const attrs: Record<string, string | true> = {}
  const type = str(node.props.type)
  if (type && type !== 'text' && type !== 'number') attrs.type = type
  Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
  if (node.props.clearable !== false) attrs.clearable = true
  Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
  Object.assign(attrs, boolAttr('readonly', node.props.readonly === true))
  Object.assign(attrs, boolAttr('show-password', node.props.showPassword === true))
  Object.assign(attrs, staticAttr('size', node.props.size))
  const minLength = num(node.props.minLength)
  if (minLength !== undefined && minLength > 0) Object.assign(attrs, bindAttr('minlength', String(minLength)))
  const maxLength = num(node.props.maxLength)
  if (maxLength !== undefined && maxLength > 0) Object.assign(attrs, bindAttr('maxlength', String(maxLength)))
  Object.assign(attrs, boolAttr('show-word-limit', node.props.showWordLimit === true))
  return attrs
}

function warnIcons(node: PageNode, ctx: MappingContext): void {
  for (const key of ['prefixIcon', 'suffixIcon']) {
    if (typeof node.props[key] === 'string' && node.props[key] !== '') {
      ctx.warn('icon-deferred', `节点 ${node.id} 的图标属性 ${key} 暂未生成`, node.id)
    }
  }
  if (node.props.appendButton === true) {
    ctx.warn('append-button-deferred', `节点 ${node.id} 的 appendButton 暂未生成`, node.id)
  }
}

function choiceChildren(
  node: PageNode,
  tag: 'el-radio' | 'el-radio-button' | 'el-checkbox' | 'el-checkbox-button',
): TemplateNode[] {
  const displayStyle = str(node.props.displayStyle)
  return optionItems(node).map((option) => {
    const attrs = optionAttrs(option)
    if (node.props.border === true) attrs.border = true
    if (displayStyle) attrs.style = `display: ${displayStyle}`
    return el(tag, attrs, [text(optionLabel(option))])
  })
}

/** 常用字段：input / textarea / number / radio / checkbox / select / switch */
export function registerFieldMappings(registry: MappingRegistry): void {
  registry.register('input', {
    tag: 'el-input',
    field: true,
    initialValue: () => '',
    attrs: (node, ctx) => {
      warnIcons(node, ctx)
      return inputAttrs(node)
    },
  })

  registry.register('textarea', {
    tag: 'el-input',
    field: true,
    initialValue: () => '',
    attrs: (node, ctx) => {
      warnIcons(node, ctx)
      const attrs = inputAttrs(node)
      attrs.type = 'textarea'
      const rows = num(node.props.rows)
      if (rows !== undefined && rows > 0) Object.assign(attrs, bindAttr('rows', String(rows)))
      return attrs
    },
  })

  registry.register('number', {
    tag: 'el-input-number',
    field: true,
    initialValue: () => null,
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      Object.assign(attrs, staticAttr('size', node.props.size))
      for (const key of ['min', 'max', 'precision', 'step'] as const) {
        const value = num(node.props[key])
        if (value !== undefined) Object.assign(attrs, bindAttr(key, String(value)))
      }
      Object.assign(attrs, staticAttr('controls-position', node.props.controlsPosition))
      return attrs
    },
  })

  registry.register('radio', {
    tag: 'el-radio-group',
    field: true,
    initialValue: () => '',
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      Object.assign(attrs, staticAttr('size', node.props.size))
      return attrs
    },
    render: (node, ctx) =>
      el(
        'el-radio-group',
        registry.get('radio')!.attrs(node, ctx),
        choiceChildren(node, node.props.buttonStyle === true ? 'el-radio-button' : 'el-radio'),
      ),
  })

  registry.register('checkbox', {
    tag: 'el-checkbox-group',
    field: true,
    initialValue: () => [],
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      Object.assign(attrs, staticAttr('size', node.props.size))
      return attrs
    },
    render: (node, ctx) =>
      el(
        'el-checkbox-group',
        registry.get('checkbox')!.attrs(node, ctx),
        choiceChildren(
          node,
          node.props.buttonStyle === true ? 'el-checkbox-button' : 'el-checkbox',
        ),
      ),
  })

  registry.register('select', {
    tag: 'el-select',
    field: true,
    initialValue: (node) => (node.props.multiple === true ? [] : ''),
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
      Object.assign(attrs, boolAttr('clearable', node.props.clearable !== false))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      Object.assign(attrs, boolAttr('filterable', node.props.filterable === true))
      Object.assign(attrs, boolAttr('allow-create', node.props.allowCreate === true))
      Object.assign(attrs, boolAttr('remote', node.props.remote === true))
      Object.assign(attrs, boolAttr('multiple', node.props.multiple === true))
      const limit = num(node.props.multipleLimit)
      if (limit !== undefined && limit > 0) Object.assign(attrs, bindAttr('multiple-limit', String(limit)))
      Object.assign(attrs, staticAttr('size', node.props.size))
      return attrs
    },
    render: (node, ctx) => {
      const options = optionItems(node).map((option) =>
        el(
          'el-option',
          {
            ':label': JSON.stringify(optionLabel(option)),
            ':value': JSON.stringify(option.value),
            ...(option.disabled === true ? { disabled: true as const } : {}),
          },
          [],
        ),
      )
      return el('el-select', registry.get('select')!.attrs(node, ctx), options)
    },
  })

  registry.register('switch', {
    tag: 'el-switch',
    field: true,
    initialValue: () => false,
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, staticAttr('active-text', node.props.activeText))
      Object.assign(attrs, staticAttr('inactive-text', node.props.inactiveText))
      Object.assign(attrs, staticAttr('active-color', node.props.activeColor))
      Object.assign(attrs, staticAttr('inactive-color', node.props.inactiveColor))
      const width = num(node.props.switchWidth)
      if (width !== undefined) Object.assign(attrs, bindAttr('width', String(width)))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      return attrs
    },
  })

  registerDateTimeMappings(registry)
}

/** 时间/日期/评分/颜色/滑块/级联 */
function registerDateTimeMappings(registry: MappingRegistry): void {
  const pickerAttrs = (node: PageNode, range: boolean): Record<string, string | true> => {
    const attrs: Record<string, string | true> = {}
    Object.assign(attrs, staticAttr('format', node.props.format))
    Object.assign(attrs, staticAttr('value-format', node.props.valueFormat))
    Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
    Object.assign(attrs, boolAttr('clearable', node.props.clearable !== false))
    Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
    Object.assign(attrs, boolAttr('readonly', node.props.readonly === true))
    Object.assign(attrs, bindAttr('editable', String(node.props.editable === true)))
    Object.assign(attrs, staticAttr('size', node.props.size))
    if (range) {
      Object.assign(attrs, boolAttr('is-range', true))
      Object.assign(attrs, staticAttr('start-placeholder', node.props.startPlaceholder))
      Object.assign(attrs, staticAttr('end-placeholder', node.props.endPlaceholder))
    }
    return attrs
  }

  registry.register('time', {
    tag: 'el-time-picker',
    field: true,
    initialValue: () => null,
    attrs: (node) => pickerAttrs(node, false),
  })

  registry.register('time-range', {
    tag: 'el-time-picker',
    field: true,
    initialValue: () => [],
    attrs: (node) => pickerAttrs(node, true),
  })

  registry.register('date', {
    tag: 'el-date-picker',
    field: true,
    initialValue: () => null,
    attrs: (node) => {
      const attrs = pickerAttrs(node, false)
      Object.assign(attrs, staticAttr('type', node.props.type))
      return attrs
    },
  })

  registry.register('date-range', {
    tag: 'el-date-picker',
    field: true,
    initialValue: () => [],
    attrs: (node) => {
      const attrs = pickerAttrs(node, true)
      Object.assign(attrs, staticAttr('type', node.props.type || 'daterange'))
      return attrs
    },
  })

  registry.register('rate', {
    tag: 'el-rate',
    field: true,
    initialValue: () => null,
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      for (const key of ['max', 'lowThreshold', 'highThreshold'] as const) {
        const value = num(node.props[key])
        if (value !== undefined) Object.assign(attrs, bindAttr(key, String(value)))
      }
      Object.assign(attrs, boolAttr('allow-half', node.props.allowHalf === true))
      Object.assign(attrs, boolAttr('show-text', node.props.showText === true))
      Object.assign(attrs, boolAttr('show-score', node.props.showScore === true))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      return attrs
    },
  })

  registry.register('color', {
    tag: 'el-color-picker',
    field: true,
    initialValue: () => null,
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, boolAttr('show-alpha', node.props.showAlpha === true))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      return attrs
    },
  })

  registry.register('slider', {
    tag: 'el-slider',
    field: true,
    initialValue: (node) => (node.props.range === true ? [] : 0),
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      for (const key of ['min', 'max', 'step'] as const) {
        const value = num(node.props[key])
        if (value !== undefined) Object.assign(attrs, bindAttr(key, String(value)))
      }
      Object.assign(attrs, boolAttr('range', node.props.range === true))
      Object.assign(attrs, boolAttr('show-stops', node.props.showStops === true))
      Object.assign(attrs, boolAttr('vertical', node.props.vertical === true))
      const height = num(node.props.height)
      if (height !== undefined && height > 0) Object.assign(attrs, bindAttr('height', String(height)))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      return attrs
    },
  })

  registry.register('cascader', {
    tag: 'el-cascader',
    field: true,
    initialValue: (node) => (node.props.multiple === true ? [] : null),
    attrs: (node) => {
      const attrs: Record<string, string | true> = {
        ':options': JSON.stringify(optionItems(node)),
      }
      Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
      Object.assign(attrs, boolAttr('multiple', node.props.multiple === true))
      Object.assign(attrs, boolAttr('check-strictly', node.props.checkStrictly === true))
      Object.assign(attrs, boolAttr('show-all-levels', node.props.showAllLevels !== false))
      Object.assign(attrs, boolAttr('clearable', node.props.clearable !== false))
      Object.assign(attrs, boolAttr('filterable', node.props.filterable === true))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      Object.assign(attrs, staticAttr('size', node.props.size))
      return attrs
    },
  })
}
