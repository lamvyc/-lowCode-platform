// @vitest-environment happy-dom
import { compileScript, parse } from '@vue/compiler-sfc'
import { mount, type VueWrapper } from '@vue/test-utils'
import * as ElementPlus from 'element-plus'
import * as Vue from 'vue'
import ts from 'typescript'

// happy-dom 未实现 ResizeObserver，Element Plus 的部分组件会用到
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

/** import { a as b, c } → const { a: b, c } = module */
function toDestructure(names: string): string {
  return names
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const alias = part.match(/^(\S+)\s+as\s+(\S+)$/)
      return alias ? `${alias[1]}: ${alias[2]}` : part
    })
    .join(', ')
}

/**
 * 把生成物顶层 import 改写成注入模块的解构：
 * 测试环境没有模块加载器，用 new Function 求值最简单。
 */
function rewriteImports(source: string): string {
  let code = source
  const rewrite = (moduleName: string, variable: string): void => {
    const pattern = new RegExp(
      `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?`,
      'g',
    )
    code = code.replace(pattern, (_match, names: string) => {
      return `const { ${toDestructure(names)} } = ${variable};`
    })
  }
  rewrite('vue', 'vue')
  rewrite('element-plus', 'elementPlus')
  rewrite('@element-plus/icons-vue', 'icons')
  rewrite('@vueup/vue-quill', 'quill')
  code = code.replace(/import\s*['"][^'"]+\.css['"];?/g, '')
  code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '')
  code = code.replace(/export\s+default\s+/, 'return ')
  return code
}

/** 把生成的 SFC 编译并真实挂载到 happy-dom */
export async function mountGeneratedSfc(code: string): Promise<{ wrapper: VueWrapper }> {
  const { descriptor, errors } = parse(code, { filename: 'generated.vue' })
  if (errors.length > 0) {
    throw new Error(`生成物解析失败: ${errors.map((error) => String(error)).join('; ')}`)
  }
  const compiled = compileScript(descriptor, {
    id: 'generated-run',
    inlineTemplate: true,
  })
  const executable = rewriteImports(compiled.content)
  // eslint-disable-next-line no-new-func
  // compileScript 保留 TS 注解（(_ctx: any)），先剥掉类型再求值
  const wrapped = `function __factory() {\n${executable}\n}`
  const js = ts.transpileModule(wrapped, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  }).outputText
  // eslint-disable-next-line no-new-func
  const createFactory = new Function(
    'vue',
    'elementPlus',
    'icons',
    'quill',
    `${js}\nreturn __factory`,
  ) as (vue: unknown, elementPlus: unknown, icons: unknown, quill: unknown) => () => unknown
  const component = createFactory(Vue, ElementPlus, {}, {})()
  const wrapper = mount(component as never, { attachTo: document.body })
  return { wrapper }
}
