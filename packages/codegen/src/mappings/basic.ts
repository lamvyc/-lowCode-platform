import { el, text } from '../ast'
import type { PageNode } from '@lowcode/schema'
import { boolAttr, staticAttr } from './helpers'
import type { MappingContext, MappingRegistry } from './types'

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function styleOf(parts: Array<string | undefined>): string | undefined {
  const list = parts.filter((part): part is string => Boolean(part))
  return list.length > 0 ? list.join('; ') : undefined
}

function fontSize(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `font-size: ${value}px`
  if (typeof value === 'string' && value !== '') return `font-size: ${value}`
  return undefined
}

function warnDeferred(node: PageNode, ctx: MappingContext): void {
  if (node.events && Object.keys(node.events).length > 0) {
    ctx.warn('events-deferred', `节点 ${node.id} 的事件动作将在 P2 生成`, node.id)
  }
  for (const key of ['icon', 'prefixIcon', 'suffixIcon']) {
    if (typeof node.props[key] === 'string' && node.props[key] !== '') {
      ctx.warn('icon-deferred', `节点 ${node.id} 的图标属性 ${key} 暂未生成`, node.id)
    }
  }
}

/** 基础组件：文本 / 静态文字 / HTML / 按钮 / 分隔线 / 图片 / 提示 */
export function registerBasicMappings(registry: MappingRegistry): void {
  registry.register('text', {
    tag: 'div',
    attrs: (node) => {
      const style = styleOf([
        typeof node.props.color === 'string' && node.props.color !== ''
          ? `color: ${node.props.color}`
          : undefined,
        fontSize(node.props.fontSize),
        node.props.bold === true ? 'font-weight: 700' : undefined,
        typeof node.props.align === 'string' ? `text-align: ${node.props.align}` : undefined,
      ])
      const attrs: Record<string, string | true> = { class: 'lc-text' }
      if (style) attrs.style = style
      return attrs
    },
    render: (node, ctx) =>
      el('div', registry.get('text')!.attrs(node, ctx), [text(str(node.props.text))]),
  })

  registry.register('static-text', {
    tag: 'div',
    attrs: (node) => {
      const style = styleOf([
        typeof node.props.columnWidth === 'string' && node.props.columnWidth !== ''
          ? `width: ${node.props.columnWidth}`
          : undefined,
        typeof node.props.textAlign === 'string' ? `text-align: ${node.props.textAlign}` : undefined,
        fontSize(node.props.fontSize),
        node.props.preWrap === true ? 'white-space: pre-wrap' : undefined,
      ])
      const attrs: Record<string, string | true> = { class: 'lc-static-text' }
      if (style) attrs.style = style
      return attrs
    },
    render: (node, ctx) =>
      el('div', registry.get('static-text')!.attrs(node, ctx), [
        text(str(node.props.textContent)),
      ]),
  })

  registry.register('html-text', {
    tag: 'div',
    attrs: (node) => {
      const attrs: Record<string, string | true> = {
        class: 'lc-html-text',
        'v-html': str(node.props.htmlContent),
      }
      if (typeof node.props.columnWidth === 'string' && node.props.columnWidth !== '') {
        attrs.style = `width: ${node.props.columnWidth}`
      }
      return attrs
    },
  })

  registry.register('button', {
    tag: 'el-button',
    attrs: (node, ctx) => {
      warnDeferred(node, ctx)
      const attrs: Record<string, string | true> = { class: 'lc-button' }
      Object.assign(attrs, staticAttr('type', node.props.type))
      Object.assign(attrs, staticAttr('size', node.props.size))
      Object.assign(attrs, boolAttr('plain', node.props.plain === true))
      Object.assign(attrs, boolAttr('round', node.props.round === true))
      Object.assign(attrs, boolAttr('circle', node.props.circle === true))
      Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
      const width =
        node.props.displayStyle === 'block'
          ? '100%'
          : typeof node.props.columnWidth === 'string'
            ? node.props.columnWidth
            : ''
      if (width !== '') attrs.style = `width: ${width}`
      return attrs
    },
    render: (node, ctx) =>
      el('el-button', registry.get('button')!.attrs(node, ctx), [
        text(str(node.props.label ?? node.props.text ?? '按钮')),
      ]),
  })

  registry.register('divider', {
    tag: 'el-divider',
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      const direction = str(node.props.direction) || 'horizontal'
      attrs.direction = direction
      if (direction === 'horizontal' && node.props.contentPosition !== 'center') {
        Object.assign(attrs, staticAttr('content-position', node.props.contentPosition))
      }
      return attrs
    },
    render: (node, ctx) => {
      const label = str(node.props.label)
      return el('el-divider', registry.get('divider')!.attrs(node, ctx), label ? [text(label)] : [])
    },
  })

  registry.register('image', {
    tag: 'el-image',
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, staticAttr('src', node.props.src))
      Object.assign(attrs, staticAttr('alt', node.props.alt))
      Object.assign(attrs, staticAttr('width', node.props.width))
      Object.assign(attrs, staticAttr('height', node.props.height))
      return attrs
    },
  })

  registry.register('alert', {
    tag: 'el-alert',
    attrs: (node) => {
      const attrs: Record<string, string | true> = {}
      Object.assign(attrs, staticAttr('title', node.props.title))
      Object.assign(attrs, staticAttr('type', node.props.type))
      Object.assign(attrs, staticAttr('description', node.props.description))
      Object.assign(attrs, boolAttr('closable', node.props.closable === true))
      Object.assign(attrs, staticAttr('close-text', node.props.closeText))
      Object.assign(attrs, boolAttr('center', node.props.center === true))
      Object.assign(attrs, boolAttr('show-icon', node.props.showIcon === true))
      Object.assign(attrs, staticAttr('effect', node.props.effect))
      return attrs
    },
  })
}
