import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { generateVueSfc } from '../generator'
import { createDefaultRegistry } from './index'
import { renderNodeToTemplate } from './test-utils'

const registry = createDefaultRegistry()

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: { id: 'p1', name: '基础', createdAt: '', updatedAt: '' },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function node(patch: Partial<PageNode> & { props?: Record<string, unknown> }): PageNode {
  return { id: 'n1', type: 'text', props: {}, ...patch } as PageNode
}

describe('基础组件映射', () => {
  it('text 输出文本与样式', () => {
    const out = renderNodeToTemplate(
      node({ type: 'text', props: { text: '旧文本', fontSize: 18, bold: true, color: '#f00' } }),
      registry,
    )
    expect(out).toContain('旧文本')
    expect(out).toContain('font-size: 18px')
    expect(out).toContain('font-weight: 700')
    expect(out).toContain('color: #f00')
  })

  it('static-text 输出文本与排版样式', () => {
    const out = renderNodeToTemplate(
      node({
        type: 'static-text',
        props: { textContent: '标题', fontSize: '20px', textAlign: 'center' },
      }),
      registry,
    )
    expect(out).toContain('标题')
    expect(out).toContain('font-size: 20px')
    expect(out).toContain('text-align: center')
  })

  it('html-text 用 v-html', () => {
    const out = renderNodeToTemplate(
      node({ type: 'html-text', props: { htmlContent: '<b>x</b>' } }),
      registry,
    )
    expect(out).toContain('v-html=')
    expect(out).toContain('lc-html-text')
  })

  it('button 支持 label 与 text 兜底', () => {
    expect(
      renderNodeToTemplate(node({ type: 'button', props: { label: '提交' } }), registry),
    ).toContain('提交')
    expect(
      renderNodeToTemplate(node({ type: 'button', props: { text: '旧按钮' } }), registry),
    ).toContain('旧按钮')
  })

  it('button 映射 type/plain/round/disabled 与块级宽度', () => {
    const out = renderNodeToTemplate(
      node({
        type: 'button',
        props: {
          label: '确定',
          type: 'primary',
          plain: true,
          round: true,
          disabled: true,
          displayStyle: 'block',
        },
      }),
      registry,
    )
    expect(out).toContain('type="primary"')
    expect(out).toContain('plain')
    expect(out).toContain('round')
    expect(out).toContain('disabled')
    expect(out).toContain('width: 100%')
  })

  it('button 图标按需从 @element-plus/icons-vue 导入', async () => {
    const { code } = await generateVueSfc(
      schemaWith([{ id: 'b1', name: 'b', type: 'button', props: { label: '搜索', icon: 'Search' } }]),
    )
    expect(code).toContain("import { Search } from '@element-plus/icons-vue'")
    expect(code).toContain(':icon="Search"')
  })

  it('divider 的 label 走默认插槽', () => {
    const out = renderNodeToTemplate(
      node({ type: 'divider', props: { label: '分组', contentPosition: 'left' } }),
      registry,
    )
    expect(out).toContain('<el-divider')
    expect(out).toContain('分组')
    expect(out).toContain('content-position="left"')
  })

  it('image 映射到 el-image', () => {
    const out = renderNodeToTemplate(
      node({ type: 'image', props: { src: '/a.png', alt: '图', width: 200, height: 120 } }),
      registry,
    )
    expect(out).toContain('<el-image')
    expect(out).toContain('src="/a.png"')
  })

  it('alert 映射到 el-alert', () => {
    const out = renderNodeToTemplate(
      node({ type: 'alert', props: { title: '提示', type: 'warning', closable: true } }),
      registry,
    )
    expect(out).toContain('<el-alert')
    expect(out).toContain('title="提示"')
    expect(out).toContain('type="warning"')
  })
})
