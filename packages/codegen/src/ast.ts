/**
 * 极简模板 AST：足够表达 Vue 模板的标签 / 属性 / 文本 / 注释。
 * 采用 AST 而非字符串拼接，是为了后续可扩展 React / HTML 等目标。
 */
export type TemplateNode =
  | {
      kind: 'element'
      tag: string
      /** 属性名 → 最终渲染值（含 v-bind / v-on 前缀） */
      attrs: Record<string, string>
      children: TemplateNode[]
    }
  | { kind: 'text'; value: string }
  | { kind: 'comment'; value: string }

export function el(tag: string, attrs: Record<string, string> = {}, children: TemplateNode[] = []): TemplateNode {
  return { kind: 'element', tag, attrs, children }
}

export function text(value: string): TemplateNode {
  return { kind: 'text', value }
}

export function comment(value: string): TemplateNode {
  return { kind: 'comment', value }
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/** 静态属性：name="value" */
export function attr(name: string): string {
  return name
}

/** 绑定属性：:name="expr" */
export function bind(name: string): string {
  return `:${name}`
}

/** 事件绑定：@name="handler" */
export function on(name: string): string {
  return `@${name}`
}

/** 指令：v-if / v-for 等 */
export function directive(name: string): string {
  return name
}

/** 把 AST 渲染为模板字符串 */
export function stringifyTemplate(node: TemplateNode, indent = 0): string {
  const pad = '  '.repeat(indent)
  switch (node.kind) {
    case 'comment':
      return `${pad}<!-- ${node.value} -->`
    case 'text':
      return node.value ? `${pad}${node.value.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}` : ''
    case 'element': {
      const attrs = Object.entries(node.attrs)
        .map(([name, value]) => `${name}="${escapeAttr(value)}"`)
        .join(' ')
      const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`
      if (node.children.length === 0) {
        return `${pad}${open}</${node.tag}>`
      }
      const inner = node.children.map((child) => stringifyTemplate(child, indent + 1)).join('\n')
      return `${pad}${open}\n${inner}\n${pad}</${node.tag}>`
    }
  }
}
