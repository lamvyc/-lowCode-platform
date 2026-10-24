import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import type { PageNode, PageSchema } from '@lowcode/schema'
import { createDefaultRegistry } from './mappings'
import { VueSfcGenerator, generateVueSfc } from './generator'

function schemaWith(nodes: PageNode[]): PageSchema {
  return {
    version: '2.0.0',
    meta: {
      id: 'p1',
      name: '生成测试',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    nodes,
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
    settings: { form: { labelPosition: 'left', labelWidth: 150 } },
  }
}

function buttonNode(): PageNode {
  return { id: 'b1', name: 'submit', type: 'button', props: { label: '提交' } }
}

function staticTextNode(): PageNode {
  return { id: 't1', name: 'title', type: 'static-text', props: { textContent: '标题' } }
}

function inputStub(): PageNode {
  return { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名' } }
}

describe('VueSfcGenerator', () => {
  it('生成只含 vue + element-plus 的 SFC', async () => {
    const { code, warnings } = await generateVueSfc(schemaWith([buttonNode(), staticTextNode()]))
    expect(code).toContain('<script setup lang="ts">')
    expect(code).toContain("from 'vue'")
    expect(code).toContain("from 'element-plus'")
    expect(code).not.toContain('@lowcode/')
    expect(code).not.toContain('未注册物料')
    expect(warnings.filter((warning) => warning.code === 'unknown-material')).toEqual([])
  })

  it('只 import 用到的 Element Plus 组件', async () => {
    const registry = createDefaultRegistry()
    registry.register('input', {
      tag: 'el-input',
      field: true,
      attrs: () => ({}),
      initialValue: () => '',
    })
    const { code } = await new VueSfcGenerator({ registry }).generate(schemaWith([inputStub()]))
    expect(code).toContain('ElInput')
    expect(code).toContain('ElForm')
    expect(code).not.toContain('ElTable')
  })

  it('字段节点自动包 el-form-item 并加 v-model', async () => {
    const registry = createDefaultRegistry()
    registry.register('input', {
      tag: 'el-input',
      field: true,
      attrs: () => ({}),
      initialValue: () => '',
    })
    const { code } = await new VueSfcGenerator({ registry }).generate(
      schemaWith([{ id: 'f1', name: 'userName', type: 'input', props: { label: '姓名' } }]),
    )
    expect(code).toContain('<el-form-item')
    expect(code).toContain('prop="userName"')
    expect(code).toContain('v-model="formData.userName"')
    expect(code).toContain('<el-form')
    expect(code).toContain('label-width="150px"')
  })

  it('没有字段时用 div.lc-page 而不是 el-form', async () => {
    const { code } = await generateVueSfc(schemaWith([buttonNode()]))
    expect(code).toContain('<div class="lc-page">')
    expect(code).not.toContain('<el-form')
  })

  it('未知物料进 warnings 且模板里有注释', async () => {
    const { code, warnings } = await generateVueSfc(
      schemaWith([{ id: 'x', type: 'nope', props: {} }]),
    )
    expect(code).toContain('未注册物料: nope')
    expect(warnings[0].code).toBe('unknown-material')
  })

  it('自定义组件映射仍可用（逃生口）', async () => {
    const { code } = await generateVueSfc(schemaWith([{ id: 'c', type: 'my-card', props: {} }]), {
      materials: { 'my-card': { importName: 'MyCard', from: '@my-pkg/cards' } },
    })
    expect(code).toContain("import { MyCard } from '@my-pkg/cards'")
    expect(code).toContain('<MyCard')
  })

  it('生成物经过 Prettier 格式化（含 TS 插件）', async () => {
    const { code } = await generateVueSfc(
      schemaWith([
        { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
      ]),
    )
    // 未格式化时规则对象是 `userName: [\n  {`；格式化后应是 4 空格缩进
    expect(code).toContain('  userName: [\n    {\n      required: true,')
  })

  it('model=content 生成 v-model:content，model=none 不生成 v-model', async () => {
    const registry = createDefaultRegistry()
    registry.register('content-field', {
      tag: 'el-input',
      field: true,
      model: 'content',
      attrs: () => ({}),
      initialValue: () => '',
    })
    registry.register('plain-field', {
      tag: 'el-input',
      field: true,
      model: 'none',
      attrs: () => ({}),
      initialValue: () => '',
    })
    const content = await new VueSfcGenerator({ registry }).generate(
      schemaWith([{ id: 'a', name: 'a', type: 'content-field', props: {} }]),
    )
    const none = await new VueSfcGenerator({ registry }).generate(
      schemaWith([{ id: 'b', name: 'b', type: 'plain-field', props: {} }]),
    )
    expect(content.code).toContain('v-model:content="formData.a"')
    expect(none.code).not.toContain('v-model')
  })

  it('sideEffectImports 生成 CSS import', async () => {
    const registry = createDefaultRegistry()
    registry.register('rich', {
      tag: 'el-input',
      field: true,
      sideEffectImports: ['@vueup/vue-quill/dist/vue-quill.snow.css'],
      attrs: () => ({}),
      initialValue: () => '',
    })
    const { code } = await new VueSfcGenerator({ registry }).generate(
      schemaWith([{ id: 'r', name: 'r', type: 'rich', props: {} }]),
    )
    expect(code).toContain("import '@vueup/vue-quill/dist/vue-quill.snow.css'")
  })

  it('静态数据源生成 ref，动态数据源给 warning', async () => {
    const schema = schemaWith([])
    schema.dataSources = [
      {
        id: 'userList',
        name: '用户',
        type: 'static',
        config: { staticData: { data: [{ name: '张三' }] } },
      },
      { id: 'remote', name: '远程', type: 'DataModel', config: { modelRef: 'm1' } },
    ]
    const { code, warnings } = await generateVueSfc(schema)
    expect(code).toContain('const userList = ref({')
    expect(code).toContain('const remote = ref(null)')
    expect(warnings.some((warning) => warning.code === 'datasource-deferred')).toBe(true)
  })

  it('具名插槽与 v-if/v-for', async () => {
    const schema = schemaWith([
      { id: 'box', type: 'card', props: {}, children: ['t'], slots: { extra: ['s'] } },
      { id: 't', type: 'static-text', props: { textContent: 'A' } },
      { id: 's', type: 'static-text', props: { textContent: 'B' } },
    ])
    schema.nodes[0].bindings = {
      visible: { type: 'expression', value: '$page.show' },
      loop: { type: 'static', value: { source: '$datasource.list', itemName: 'item' } },
    }
    schema.variables = [{ id: 'v', name: 'show', value: true }]
    schema.dataSources = [
      { id: 'list', name: 'list', type: 'static', config: { staticData: [] } },
    ]
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('<template #extra>')
    expect(code).toContain('v-if="show"')
    expect(code).toContain('v-for="(item, index) in list"')
    expect(code).toContain(':key="index"')
  })

  it('form functions 与三个表单事件进入生成物', async () => {
    const schema = schemaWith([{ id: 'f1', name: 'a', type: 'input', props: { label: 'A' } }])
    schema.settings = {
      form: {
        functions: 'function hello() { return 1 }',
        onFormCreated: 'console.log(\'created\')',
        onFormMounted: 'console.log(\'mounted\')',
        onFormDataChange: 'console.log(fieldName, newValue)',
      },
    }
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('function hello()')
    expect(code).toContain("console.log('created')")
    expect(code).toContain('onMounted(')
    expect(code).toContain('watch(')
    expect(code).toContain('onFormDataChange')
  })

  it('生成的代码可被 @vue/compiler-sfc 解析', async () => {
    const { code } = await generateVueSfc(schemaWith([buttonNode(), staticTextNode()]))
    const { errors } = parse(code, { filename: 'page.vue' })
    expect(errors).toHaveLength(0)
  })

  it('表格/卡片/标签页的组合模板可生成并解析', async () => {
    const schema = schemaWith([
      {
        id: 'card1',
        type: 'card',
        props: { label: '分组' },
        children: ['tab1'],
      },
      {
        id: 'tab1',
        type: 'tab',
        props: {},
        children: ['pane1'],
      },
      { id: 'pane1', type: 'tab-pane', props: { label: '第一页' }, children: ['t1'] },
      staticTextNode(),
    ])
    const { code } = await generateVueSfc(schema)
    expect(parse(code, { filename: 'page.vue' }).errors).toHaveLength(0)
    expect(code).toContain('cardCollapsed_card1')
    expect(code).toContain('tabActive_tab1')
  })
})
