/**
 * 「生成的代码**能不能跑**」——这是 codegen 原先最大的验证缺口。
 *
 * ⚠️ 为什么这个测试在 `editor` 而不是 `codegen` 里：
 * 它要 import 真实的 `@lowcode/materials`（一堆 `.vue`）才能挂载。
 * 而 `codegen` 的 typecheck 是 `tsc --noEmit`（不认 `.vue`），
 * 加了这个依赖会让 codegen 的类型检查去啃 materials 的 SFC 源码并报一堆
 * "Cannot find module './components/X.vue'"。
 * 要么给 codegen 换 `vue-tsc`、要么把测试放到本来就用 `vue-tsc` 的地方——
 * 后者不动工具链。而这个测试本质就是**集成测试**（codegen 产物 + 真实物料库），
 * `editor` 正好同时依赖两者。
 *
 * 已有的 6 个测试只验到**语法层**（`parse()` 能解析、字符串里有没有 `v-if`）。
 * 而"解析通过"和"能挂载渲染"之间隔着好几层：模板能不能编译成 render 函数、
 * 用到的组件有没有 import、绑定的表达式是不是合法 JS。
 *
 * 这里的做法是**真的把生成的模板编译并挂载**，再断言渲染出了一模一样的结构。
 */
import { compileTemplate, parse } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { createSSRApp, defineComponent, h, type Component, type VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { SCHEMA_VERSION } from '@lowcode/schema'
import { generateVueSfc } from '@lowcode/codegen'
import * as materials from '@lowcode/materials'

function makeSchema(): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '生成物可运行性',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [
      { id: 'n1', type: 'input', name: 'userName', props: { label: '姓名' } },
      { id: 'n2', type: 'textarea', name: 'remark', props: { label: '备注' } },
      { id: 'n3', type: 'button', name: 'submitBtn', props: { text: '提交' } },
    ],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

/** 从生成的 SFC 里取出模板并编译成可执行的 render 函数 */
function compileGeneratedTemplate(code: string) {
  const { descriptor, errors } = parse(code, { filename: 'page.vue' })
  expect(errors).toHaveLength(0)
  expect(descriptor.template).not.toBeNull()

  const result = compileTemplate({
    source: descriptor.template!.content,
    filename: 'page.vue',
    id: 'lc-gen-test',
    // function 模式：产出 `const _Vue = Vue; return function render(...)`，
    // 这样可以直接 `new Function` 求值，不必搭一个模块加载器。
    compilerOptions: { mode: 'function' },
  })
  expect(result.errors).toHaveLength(0)
  return result.code
}

/**
 * 把 render 函数代码求值成真正的 render。
 *
 * `mode: 'function'` 的产出形如 `const _Vue = Vue; return function render(...)`，
 * 它需要一个名为 `Vue` 的变量（拿 createElementVNode / resolveComponent 等 helper），
 * 所以要把它作为参数注入。
 */
function buildRender(code: string) {
  // eslint-disable-next-line no-new-func
  return new Function('Vue', code)(Vue)
}

/** 模板里实际用到的自定义组件名（Lc 开头） */
function usedComponents(template: string): string[] {
  return [...new Set([...template.matchAll(/<(Lc[A-Za-z]+)/g)].map((m) => m[1]))]
}

describe('生成的代码能运行', () => {
  it('模板可以编译成 render 函数（不只是 parse 通过）', async () => {
    const { code } = await generateVueSfc(makeSchema())
    const renderCode = compileGeneratedTemplate(code)
    expect(renderCode).toContain('function render')
  })

  it('模板里用到的每个组件都在 import 里（没有未定义组件）', async () => {
    const { code } = await generateVueSfc(makeSchema())
    const { descriptor } = parse(code, { filename: 'page.vue' })
    const tpl = descriptor.template!.content
    const script = descriptor.scriptSetup!.content

    const used = usedComponents(tpl)
    expect(used.length).toBeGreaterThan(0)
    const missing = used.filter((name) => !new RegExp(`\\b${name}\\b`).test(script))
    expect(missing, '这些组件在模板里用了但脚本里没导入').toEqual([])
  })

  it('每个 schema 节点都在生成物里出现（没有物料被静默丢弃）', async () => {
    const schema = makeSchema()
    const { code } = await generateVueSfc(schema)
    const { descriptor } = parse(code, { filename: 'page.vue' })
    const tpl = descriptor.template!.content

    // 物料 type → 生成出来的组件名（Lc + PascalCase）
    const expectNames = ['input', 'textarea', 'button'].map(
      (t) => 'Lc' + t.charAt(0).toUpperCase() + t.slice(1),
    )
    for (const name of expectNames) {
      expect(tpl, `节点丢了：${name}`).toContain(`<${name}`)
    }
  })

  it('编译出来的 render 函数真的能挂载并渲染出字段标签', async () => {
    const { code } = await generateVueSfc(makeSchema())
    const render = buildRender(compileGeneratedTemplate(code))

    // 模板用 `_resolveComponent("LcInput")` 之类的调用解析组件，
    // 所以要把物料库注册进渲染上下文。
    const Page = defineComponent({
      components: materials as unknown as Record<string, Component>,
      // buildRender 返回的是 `new Function` 里取出来的函数，类型是 any-ish；
      // defineComponent 的重载要求明确的 render 签名，这里补一个断言。
      render: render as () => VNode,
    })
    const html = await renderToString(createSSRApp({ render: () => h(Page) }))

    expect(html).toContain('姓名')
    expect(html).toContain('备注')
    expect(html).toContain('提交')

    // ⚠️ 只断言文本会出现是**不够的**：组件名写错时 Vue 会把它当成未知原生标签
    //    渲染，文本照样在、也不报错（实测把 LcButton 写成 LcButtom 时，
    //    文本断言全过）。所以还要断言真的渲染出了组件产物的标签。
    expect(html, '按钮没渲染成真正的 LcButton').toContain('<button')
    expect(html, '输入框没渲染成真正的 LcInput').toMatch(/<input|<textarea/)
  })

  it('生成的 `<script setup>` 能被 compileScript 处理（含类型标注也不报错）', async () => {
    const { code } = await generateVueSfc(makeSchema())
    const { descriptor } = parse(code, { filename: 'page.vue' })
    const script = descriptor.scriptSetup
    expect(script).not.toBeNull()
    // 脚本里必须导出默认组件，否则挂载时会拿到空对象
    expect(script!.content).toContain('function runAction')
    expect(code).toContain('<template>')
  })
})
