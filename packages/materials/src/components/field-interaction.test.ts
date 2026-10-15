// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineComponent, h, inject, isRef } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ElSelect } from 'element-plus'
import { ActionRegistry } from '@lowcode/core'
import { SCHEMA_VERSION, type PageNode, type PageSchema } from '@lowcode/schema'
import {
  RUNTIME_CONTEXT_KEY,
  RuntimeContext,
  RuntimeRenderer,
  type IComponentResolver,
} from '@lowcode/runtime'
import { MATERIAL_COMPONENTS } from '../materials'
import { useRuntimeContext } from '../use-runtime'
import LcCheckbox from './Checkbox.vue'
import LcRadio from './Radio.vue'
import LcSelect from './Select.vue'

// happy-dom 未实现 ResizeObserver，Element Plus 的部分组件会用到
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

const resolver: IComponentResolver = {
  resolve: (type) => MATERIAL_COMPONENTS[type],
  has: (type) => type in MATERIAL_COMPONENTS,
}

function makeSchema(nodes: PageNode[]): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '组件交互测试',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}

function makeContext(nodes: PageNode[]): RuntimeContext {
  return new RuntimeContext({
    schema: makeSchema(nodes),
    resolver,
    actionRegistry: new ActionRegistry(),
  })
}

/** 用真实物料渲染整个节点树 */
function mountSchema(context: RuntimeContext, designMode = false) {
  return mount(RuntimeRenderer, {
    props: { schema: context.schema, context, designMode },
  })
}

describe('第 1 步：真实 ElInput 输入写回运行时值', () => {
  it('打字后值落到运行时存储，且不改写 schema', async () => {
    const context = makeContext([
      { id: 'n1', name: 'userName', type: 'input', props: { modelValue: 'init' } },
    ])
    const wrapper = mountSchema(context)

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('init')

    await input.setValue('typed')

    expect(context.getNodeValue('n1')).toBe('typed')
    // schema 里的默认值必须保持原样
    expect(context.getNode('n1')?.props.modelValue).toBe('init')
  })

  it('重置后回落到默认值', async () => {
    const context = makeContext([
      { id: 'n1', name: 'userName', type: 'input', props: { modelValue: 'init' } },
    ])
    const wrapper = mountSchema(context)
    await wrapper.find('input').setValue('typed')
    expect(context.getNodeValue('n1')).toBe('typed')

    context.getWidgetRef('userName')?.resetField()
    await wrapper.vm.$nextTick()

    expect(context.getNodeValue('n1')).toBe('init')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('init')
  })
})

describe('第 2 步：useRuntimeContext 跟随上下文替换', () => {
  const Probe = defineComponent({
    name: 'ContextProbe',
    setup() {
      const runtime = useRuntimeContext()
      return () => h('span', { class: 'probe' }, runtime.value?.schema.meta.name ?? 'none')
    },
  })

  const probeResolver: IComponentResolver = {
    resolve: (type) => (type === 'ctx-probe' ? Probe : undefined),
    has: (type) => type === 'ctx-probe',
  }

  function makeNamedContext(name: string): RuntimeContext {
    const base = makeSchema([{ id: 'p1', type: 'ctx-probe', props: {} }])
    return new RuntimeContext({
      schema: { ...base, meta: { ...base.meta, name } },
      resolver: probeResolver,
      actionRegistry: new ActionRegistry(),
    })
  }

  it('上下文被替换后，注入方读到的是新上下文（不是陈旧对象）', async () => {
    const ctxA = makeNamedContext('CTX_A')
    const ctxB = makeNamedContext('CTX_B')

    const Host = defineComponent({
      props: { context: { type: Object, required: true } },
      setup(props) {
        const current = () => props.context as RuntimeContext
        return () => h(RuntimeRenderer, { schema: current().schema, context: current() })
      },
    })

    const wrapper = mount(Host, { props: { context: ctxA } })
    expect(wrapper.find('.probe').text()).toBe('CTX_A')

    await wrapper.setProps({ context: ctxB })
    // 若 provide 只执行一次（旧实现），这里仍会是 CTX_A
    expect(wrapper.find('.probe').text()).toBe('CTX_B')
  })

  it('RUNTIME_CONTEXT_KEY 注入方拿到 ref', () => {
    let injectedIsRef: boolean | undefined
    const ProbeRef = defineComponent({
      setup() {
        injectedIsRef = isRef(inject(RUNTIME_CONTEXT_KEY, undefined))
        return () => h('span')
      },
    })
    const localResolver: IComponentResolver = {
      resolve: (type) => (type === 'probe2' ? ProbeRef : undefined),
      has: (type) => type === 'probe2',
    }
    const context = new RuntimeContext({
      schema: makeSchema([{ id: 'x', type: 'probe2', props: {} }]),
      resolver: localResolver,
      actionRegistry: new ActionRegistry(),
    })
    mount(RuntimeRenderer, { props: { schema: context.schema, context } })
    expect(injectedIsRef).toBe(true)
  })
})

describe('第 0 步：radio 的 displayStyle 无条件绑到 CSS display', () => {
  const options = [
    { label: 'A', value: 1 },
    { label: 'B', value: 2 },
  ]

  it("inline 时元素的 display 计算为 'inline'（而不是 Element 默认的 inline-block）", () => {
    const wrapper = mount(LcRadio, { props: { displayStyle: 'inline', optionItems: options } })
    const first = wrapper.find('.el-radio').element as HTMLElement
    expect(first.style.display).toBe('inline')
  })

  it("block 时元素的 display 为 'block'", () => {
    const wrapper = mount(LcRadio, { props: { displayStyle: 'block', optionItems: options } })
    const first = wrapper.find('.el-radio').element as HTMLElement
    expect(first.style.display).toBe('block')
  })

  it('buttonStyle 分支同样生效', () => {
    const wrapper = mount(LcRadio, {
      props: { displayStyle: 'block', buttonStyle: true, optionItems: options },
    })
    const first = wrapper.find('.el-radio-button').element as HTMLElement
    expect(first.style.display).toBe('block')
  })

  it('按钮样式下不在 DOM 上留下 border 属性（EP 已移除该 prop）', () => {
    const wrapper = mount(LcRadio, {
      props: { buttonStyle: true, border: true, optionItems: options },
    })
    const first = wrapper.find('.el-radio-button').element as HTMLElement
    expect(first.hasAttribute('border')).toBe(false)
  })

  it('根元素带 .lc-radio，且样式覆盖了 .el-radio-group 的 display', () => {
    const wrapper = mount(LcRadio, { props: { optionItems: options } })
    expect(wrapper.find('.lc-radio').exists()).toBe(true)

    // ⚠️ 这里只能做**源码级**守卫。
    //
    // 真实缺陷（已在 Chrome 里复现并修复）：Element Plus 把 .el-radio-group 设成
    // `display: inline-flex`，选项成为 flex item 后其 `display` 会被「块化」，
    // 导致 displayStyle='block' 时各选项仍挤在同一行——属性面板改了完全没效果。
    // 修法是把容器恢复成 Element UI 的 `inline-block`（见 Radio.vue 的 style 块）。
    //
    // 布局正确性 happy-dom 测不到（没有布局引擎），因此这里只断言"补丁还在"，
    // 真正的校验走真实浏览器：`node scripts/cdp-inspect.mjs`（见 docs/interaction-spec/README.md 7.8）。
    const source = readFileSync(join(process.cwd(), 'src/components/Radio.vue'), 'utf8')
    expect(source).toContain(':deep(.el-radio-group)')
    expect(source).toMatch(/display:\s*inline-block/)
  })
})

describe('第 0 步（补）：checkbox 的 displayStyle 也要无条件绑到 CSS display', () => {
  const options = [
    { label: 'A', value: 1 },
    { label: 'B', value: 2 },
  ]

  it("inline 时显式设成 'inline'（而不是留空、落到 Element Plus 的 inline-flex 默认值）", () => {
    const wrapper = mount(LcCheckbox, { props: { displayStyle: 'inline', optionItems: options } })
    const first = wrapper.find('.el-checkbox').element as HTMLElement
    // 参考实现是 :style="{display: displayStyle}" —— 无条件绑定，inline 时给的就是 inline
    expect(first.style.display).toBe('inline')
  })

  it("block 时显式设成 'block'", () => {
    const wrapper = mount(LcCheckbox, { props: { displayStyle: 'block', optionItems: options } })
    const first = wrapper.find('.el-checkbox').element as HTMLElement
    expect(first.style.display).toBe('block')
  })

  it('按钮样式分支同样无条件绑定', () => {
    const wrapper = mount(LcCheckbox, {
      props: { displayStyle: 'inline', buttonStyle: true, optionItems: options },
    })
    const first = wrapper.find('.el-checkbox-button').element as HTMLElement
    expect(first.style.display).toBe('inline')
  })
})

describe('第 0 步：select 的 defaultFirstOption 与 remoteMethod', () => {
  const bare = { optionItems: [{ label: 'A', value: 1 }] }

  it('filterable + allowCreate 同时为真时 defaultFirstOption 为 true', () => {
    const wrapper = mount(LcSelect, {
      props: { ...bare, filterable: true, allowCreate: true },
    })
    expect(wrapper.findComponent(ElSelect).props('defaultFirstOption')).toBe(true)
  })

  it('只开 filterable 时为 false', () => {
    const wrapper = mount(LcSelect, { props: { ...bare, filterable: true } })
    expect(wrapper.findComponent(ElSelect).props('defaultFirstOption')).toBe(false)
  })

  it('只开 allowCreate 时为 false', () => {
    const wrapper = mount(LcSelect, { props: { ...bare, allowCreate: true } })
    expect(wrapper.findComponent(ElSelect).props('defaultFirstOption')).toBe(false)
  })

  it('remote 为真但没有 onRemoteQuery 时，remoteMethod 必须是 undefined（不是空函数）', () => {
    const wrapper = mount(LcSelect, { props: { ...bare, remote: true } })
    expect(wrapper.findComponent(ElSelect).props('remoteMethod')).toBeUndefined()
  })

  it('remote 为真且有 onRemoteQuery 时才挂上函数', () => {
    const onRemoteQuery = (): void => {}
    const wrapper = mount(LcSelect, { props: { ...bare, remote: true, onRemoteQuery } })
    expect(wrapper.findComponent(ElSelect).props('remoteMethod')).toBeTypeOf('function')
  })

  it('placeholder 为空时回落到「请选择」', () => {
    const wrapper = mount(LcSelect, { props: { ...bare, placeholder: '' } })
    expect(wrapper.findComponent(ElSelect).props('placeholder')).toBe('请选择')
  })
})

describe('FormItem：requiredHint / validationHint 不作为常显提示渲染', () => {
  it('未校验时不显示这两个文案', () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'userName',
        type: 'input',
        props: { modelValue: '', required: true, requiredHint: '请输入姓名', validationHint: '格式不对' },
      },
    ])
    const wrapper = mountSchema(context)
    const text = wrapper.text()
    expect(text).not.toContain('请输入姓名')
    expect(text).not.toContain('格式不对')
  })

  it('必填时标签前有星号', () => {
    const context = makeContext([
      { id: 'n1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
    ])
    const wrapper = mountSchema(context)
    expect(wrapper.find('.lc-form-item__required').exists()).toBe(true)
  })
})

describe('第 3 步：校验错误的出现与消失时机（真实挂载）', () => {
  function errorText(wrapper: ReturnType<typeof mountSchema>): string | undefined {
    const el = wrapper.find('.lc-form-item__error')
    return el.exists() ? el.text() : undefined
  }

  /**
   * 触发失焦。
   *
   * ⚠️ 必须先 focus 再 blur：Element Plus 的输入框用 `useFocusController` 管理焦点，
   * **没有先 focus 的裸 blur 不会 emit `blur`**。这也更接近真实用户操作序列。
   */
  async function blurInput(wrapper: ReturnType<typeof mountSchema>, index = 0): Promise<void> {
    const input = wrapper.findAll('input')[index]
    await input.trigger('focus')
    await input.trigger('blur')
  }

  it('必填字段失焦时出现错误，默认文案是「字段值不可为空」', async () => {
    const context = makeContext([
      { id: 'n1', name: 'email', type: 'input', props: { modelValue: '', label: '邮箱', required: true } },
    ])
    const wrapper = mountSchema(context)
    expect(errorText(wrapper)).toBeUndefined()

    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('字段值不可为空')
  })

  it('⚠️ 填上值并 change 之后，过期的必填错误被清掉', async () => {
    const context = makeContext([
      { id: 'n1', name: 'email', type: 'input', props: { modelValue: '', label: '邮箱', required: true } },
    ])
    const wrapper = mountSchema(context)

    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('字段值不可为空')

    await wrapper.find('input').setValue('a@b.com')
    await wrapper.find('input').trigger('change')
    expect(errorText(wrapper)).toBeUndefined()
  })

  it('requiredHint 作为错误文案', async () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'email',
        type: 'input',
        props: { modelValue: '', label: '邮箱', required: true, requiredHint: '请填写邮箱' },
      },
    ])
    const wrapper = mountSchema(context)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('请填写邮箱')
  })

  it('格式校验：非法值失焦报错，文案带 [label] 前缀', async () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'email',
        type: 'input',
        props: { modelValue: 'not-an-email', label: '邮箱', validation: 'email' },
      },
    ])
    const wrapper = mountSchema(context)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('[邮箱]邮箱格式有误')
  })

  it('validationHint 覆盖默认文案', async () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'email',
        type: 'input',
        props: {
          modelValue: 'bad',
          label: '邮箱',
          validation: 'email',
          validationHint: '邮箱不对',
        },
      },
    ])
    const wrapper = mountSchema(context)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('邮箱不对')
  })

  it('⚠️ 非必填 + 格式校验：空输入失焦**不报错**（空值不校验）', async () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'email',
        type: 'input',
        props: { modelValue: '', label: '邮箱', validation: 'email' },
      },
    ])
    const wrapper = mountSchema(context)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBeUndefined()
  })

  it('⚠️ 设计态不校验，也不显示错误（画布不做即时校验）', async () => {
    const context = makeContext([
      { id: 'n1', name: 'email', type: 'input', props: { modelValue: '', label: '邮箱', required: true } },
    ])
    const wrapper = mountSchema(context, true)

    await blurInput(wrapper)
    expect(errorText(wrapper)).toBeUndefined()
    expect(context.getFieldError('n1')).toBeUndefined()
    // 但值同步照常：设计态里输入仍然写回运行时
    await wrapper.find('input').setValue('typed')
    expect(context.getNodeValue('n1')).toBe('typed')
  })

  it('从预览切回设计态时，遗留的校验错误被清空（两者共用同一个 context）', async () => {
    const context = makeContext([
      { id: 'n1', name: 'email', type: 'input', props: { modelValue: '', label: '邮箱', required: true } },
    ])
    // 预览态：designMode = false，校验会跑
    const wrapper = mountSchema(context, false)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('字段值不可为空')

    // 切回设计态
    await wrapper.setProps({ designMode: true })
    expect(context.getFieldError('n1')).toBeUndefined()
    expect(errorText(wrapper)).toBeUndefined()
  })

  it('setRequired 之后立即按新规则校验', async () => {    const context = makeContext([
      { id: 'n1', name: 'email', type: 'input', props: { modelValue: '', label: '邮箱' } },
    ])
    const wrapper = mountSchema(context)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBeUndefined()

    context.getWidgetRef('email')!.setRequired(true)
    await blurInput(wrapper)
    expect(errorText(wrapper)).toBe('字段值不可为空')
  })

  it('radio：选中一个值后 change 不产生必填错误', async () => {
    const context = makeContext([
      {
        id: 'n1',
        name: 'gender',
        type: 'radio',
        props: {
          label: '性别',
          required: true,
          modelValue: null,
          optionItems: [
            { label: '男', value: 'm' },
            { label: '女', value: 'f' },
          ],
        },
      },
    ])
    const wrapper = mountSchema(context)

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios.length).toBeGreaterThan(0)
    await radios[0].setValue()

    expect(context.getNodeValue('n1')).toBe('m')
    expect(errorText(wrapper)).toBeUndefined()
  })

  it('多个字段的错误互不干扰', async () => {
    const context = makeContext([
      { id: 'a', name: 'a', type: 'input', props: { modelValue: '', label: 'A', required: true } },
      { id: 'b', name: 'b', type: 'input', props: { modelValue: '', label: 'B', required: true } },
    ])
    const wrapper = mountSchema(context)

    await blurInput(wrapper, 0)
    await blurInput(wrapper, 1)

    expect(context.getFieldError('a')).toBeTypeOf('string')
    expect(context.getFieldError('b')).toBeTypeOf('string')
    expect(wrapper.findAll('.lc-form-item__error')).toHaveLength(2)

    await wrapper.findAll('input')[0].setValue('filled')
    await wrapper.findAll('input')[0].trigger('change')

    expect(context.getFieldError('a')).toBeUndefined()
    expect(context.getFieldError('b')).toBeTypeOf('string')
    expect(wrapper.findAll('.lc-form-item__error')).toHaveLength(1)
  })
})
