// @vitest-environment happy-dom
/**
 * 生成的代码**交互**是否可用。
 *
 * `generated-runs.test.ts` 验到"模板能编译、能挂载渲染"，
 * 但**点了会不会真的触发动作**没验——而事件绑定正是低代码页面最核心的部分。
 *
 * 做法：把生成物拆成两半各自执行，再合起来挂载点一下。
 *   ① 模板 → `compileTemplate(mode: 'function')` → render 函数
 *   ② 脚本 → 去掉 import 后求值 → 拿到 `onClick_xxx` 等处理函数
 *   ③ 把处理函数交给 render 的 `_ctx`，挂载后真实 `click()`，断言动作副作用
 *
 * 用 `navigate` 动作作为观察点：它在生成代码里的实现是
 * `location.hash = action.config.route`——**可观测、确定、不需要网络**。
 */
import { compileTemplate, parse } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { createApp, defineComponent, h, reactive, ref, onMounted, type Component } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { generateVueSfc } from '@lowcode/codegen'
import * as materials from '@lowcode/materials'

let host: HTMLElement | null = null
afterEach(() => {
  host?.remove()
  host = null
  location.hash = ''
})

function makeSchema(withAction: boolean) {
  return {
    version: '1.0.0',
    meta: { id: 'p', name: '交互', route: '/' },
    nodes: [
      {
        id: 'n1',
        type: 'button',
        name: 'goBtn',
        props: { text: '去详情' },
        events: withAction
          ? {
              click: [
                {
                  id: 'a1',
                  kind: 'navigate',
                  config: { route: '#/detail' },
                },
              ],
            }
          : undefined,
      },
    ],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  } as never
}

/** 取出模板并编译成可执行的 render */
function compileRender(code: string) {
  const { descriptor, errors } = parse(code, { filename: 'page.vue' })
  expect(errors).toHaveLength(0)
  const result = compileTemplate({
    source: descriptor.template!.content,
    filename: 'page.vue',
    id: 'lc-gen-interaction',
    compilerOptions: { mode: 'function' },
  })
  expect(result.errors).toHaveLength(0)
  // eslint-disable-next-line no-new-func
  return (new Function('Vue', result.code) as (v: unknown) => () => unknown)(Vue)
}

/**
 * 求值生成的 `<script setup>`（去掉 import），返回其中定义的函数。
 *
 * 生成物脚本里只有两类 import（vue 的 API、物料组件），前者由这里注入，
 * 后者只被模板用到、脚本里并不引用，所以剥掉 import 不影响求值。
 */
function evalScript(code: string): Record<string, (...args: unknown[]) => unknown> {
  const { descriptor } = parse(code, { filename: 'page.vue' })
  const raw = descriptor.scriptSetup!.content
  const names = [...raw.matchAll(/^function (\w+)/gm)].map((m) => m[1])
  const body = raw.replace(/^import .*$/gm, '')
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'reactive',
    'ref',
    'onMounted',
    body + `\nreturn { ${names.join(', ')} }`,
  ) as (...a: unknown[]) => Record<string, (...args: unknown[]) => unknown>
  return factory(reactive, ref, onMounted)
}

async function mountGenerated(code: string) {
  const render = compileRender(code)
  const handlers = evalScript(code)
  const Page = defineComponent({
    components: materials as unknown as Record<string, Component>,
    setup() {
      return handlers
    },
    render,
  })
  host = document.createElement('div')
  document.body.appendChild(host)
  createApp({ render: () => h(Page) }).mount(host)
  await new Promise((r) => setTimeout(r, 30))
  return host
}

describe('生成的代码交互可用', () => {
  it('按钮渲染出来，且绑了 click 处理函数', async () => {
    const { code } = await generateVueSfc(makeSchema(true))
    const el = await mountGenerated(code)
    const btn = el.querySelector('button')
    expect(btn).not.toBeNull()
    expect(btn!.textContent).toContain('去详情')
    expect(code).toContain('onClick_n1')
  })

  it('点击按钮真的触发了 navigate 动作（location.hash 变化）', async () => {
    const { code } = await generateVueSfc(makeSchema(true))
    const el = await mountGenerated(code)
    expect(location.hash).toBe('')
    el.querySelector<HTMLButtonElement>('button')!.click()
    await new Promise((r) => setTimeout(r, 30))
    expect(location.hash).toBe('#/detail')
  })

  it('没有动作的按钮点一下什么也不发生（也不报错）', async () => {
    const { code } = await generateVueSfc(makeSchema(false))
    const el = await mountGenerated(code)
    expect(() => el.querySelector<HTMLButtonElement>('button')!.click()).not.toThrow()
    expect(location.hash).toBe('')
  })
})
