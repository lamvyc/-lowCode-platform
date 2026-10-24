import { el, text, type TemplateNode } from '../ast'
import { sanitizeIdentifier } from '../plan'
import type { PageNode } from '@lowcode/schema'
import { bindAttr, boolAttr, renderChildren, staticAttr } from './helpers'
import type { MappingRegistry } from './types'

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stateName(prefix: string, node: PageNode): string {
  return `${prefix}_${sanitizeIdentifier(node.id, 'node')}`
}

/** 卡片属性（width / shadow） */
function cardAttrs(node: PageNode): Record<string, string | true> {
  const attrs: Record<string, string | true> = {}
  Object.assign(attrs, staticAttr('shadow', node.props.shadow))
  const width = str(node.props.width)
  if (width && width !== 'auto') attrs.style = `width: ${width}`
  return attrs
}

/** 卡片：el-card + header 插槽 + 折叠按钮 */
function cardMapping(): Parameters<MappingRegistry['register']>[1] {
  return {
    tag: 'el-card',
    attrs: (node) => cardAttrs(node),
    setup: (node) => {
      const state = stateName('cardCollapsed', node)
      return [`const ${state} = ref(${JSON.stringify(node.props.collapsed === true)})`]
    },
    render: (node, ctx) => {
      const state = stateName('cardCollapsed', node)
      const children = renderChildren(node, ctx)
      const content: TemplateNode[] = [
        el('div', { 'v-show': `!${state}` }, children),
      ]
      const hideTitle = node.props.hideTitle === true
      if (!hideTitle) {
        const headerChildren: TemplateNode[] = [
          el('span', { class: 'lc-card__title' }, [text(str(node.props.label))]),
        ]
        if (node.props.showCollapse !== false) {
          headerChildren.push(
            el(
              'el-button',
              { link: true, size: 'small', '@click': `${state} = !${state}` },
              [text(`{{ ${state} ? '展开' : '收起' }}`)],
            ),
          )
        }
        content.unshift(
          el('template', { '#header': true }, [
            el('div', { class: 'lc-card__header' }, headerChildren),
          ]),
        )
      }
      return el('el-card', cardAttrs(node), content)
    },
  }
}

/** 栅格行：el-row，colHeight 通过 CSS 变量下传 */
const gridMapping: Parameters<MappingRegistry['register']>[1] = {
  tag: 'el-row',
  attrs: (node) => {
    const attrs: Record<string, string | true> = {}
    const gutter = num(node.props.gutter)
    if (gutter !== undefined) Object.assign(attrs, bindAttr('gutter', String(gutter)))
    Object.assign(attrs, staticAttr('justify', node.props.justify))
    const height = num(node.props.colHeight)
    attrs[':style'] = `{ '--lc-grid-col-height': ${JSON.stringify(
      height !== undefined && height > 0 ? `${height}px` : 'auto',
    )} }`
    return attrs
  },
  render: (node, ctx) => el('el-row', gridMapping.attrs(node, ctx), renderChildren(node, ctx)),
}

/** 栅格列：响应式走 md/sm/xs，否则 span */
const gridColMapping: Parameters<MappingRegistry['register']>[1] = {
  tag: 'el-col',
  attrs: (node) => {
    const attrs: Record<string, string | true> = {}
    if (node.props.responsive === true) {
      for (const breakpoint of ['md', 'sm', 'xs'] as const) {
        const value = num(node.props[breakpoint])
        if (value !== undefined) Object.assign(attrs, bindAttr(breakpoint, String(value)))
      }
    } else {
      const span = num(node.props.span)
      if (span !== undefined) Object.assign(attrs, bindAttr('span', String(span)))
    }
    for (const key of ['offset', 'push', 'pull'] as const) {
      const value = num(node.props[key])
      if (value !== undefined && value > 0) Object.assign(attrs, bindAttr(key, String(value)))
    }
    return attrs
  },
  render: (node, ctx) => el('el-col', gridColMapping.attrs(node, ctx), renderChildren(node, ctx)),
}

function paneName(node: PageNode): string {
  return str(node.props.paneName) || node.id
}

/** 标签页：el-tabs + v-model，默认激活 activeName / active pane / 第一个 pane */
const tabMapping: Parameters<MappingRegistry['register']>[1] = {
  tag: 'el-tabs',
  attrs: (node) => {
    const attrs: Record<string, string | true> = {
      'v-model': stateName('tabActive', node),
    }
    const displayType = str(node.props.displayType)
    if (displayType !== '') Object.assign(attrs, staticAttr('type', displayType))
    return attrs
  },
  setup: (node, ctx) => {
    const panes = (node.children ?? [])
      .map((id) => ctx.nodes.get(id))
      .filter((pane): pane is PageNode => Boolean(pane))
    const explicit = str(node.props.activeName)
    const activePane = panes.find((pane) => pane.props.active === true)
    const first = panes[0]
    const active = explicit || (activePane ? paneName(activePane) : first ? paneName(first) : '')
    return [`const ${stateName('tabActive', node)} = ref(${JSON.stringify(active)})`]
  },
  render: (node, ctx) => el('el-tabs', tabMapping.attrs(node, ctx), renderChildren(node, ctx)),
}

/** 标签页面板：el-tab-pane */
const tabPaneMapping: Parameters<MappingRegistry['register']>[1] = {
  tag: 'el-tab-pane',
  attrs: (node) => {
    const attrs: Record<string, string | true> = {
      label: str(node.props.label),
      name: paneName(node),
    }
    Object.assign(attrs, boolAttr('disabled', node.props.disabled === true))
    return attrs
  },
  render: (node, ctx) => el('el-tab-pane', tabPaneMapping.attrs(node, ctx), renderChildren(node, ctx)),
}

/** 注册容器映射（P0：卡片 / 栅格 / 标签页；表格在 Task 8） */
export function registerContainerMappings(registry: MappingRegistry): void {
  registry.register('card', cardMapping())
  registry.register('grid', gridMapping)
  registry.register('grid-col', gridColMapping)
  registry.register('tab', tabMapping)
  registry.register('tab-pane', tabPaneMapping)
}
