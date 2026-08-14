import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import type { PageSchema } from '@lowcode/schema'
import { SCHEMA_VERSION } from '@lowcode/schema'
import { VueSfcGenerator, generateVueSfc, rewriteExpression } from '@lowcode/codegen'

function makeSchema(): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'p1',
      name: '订单页',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    },
    nodes: [
      {
        id: 'n_container',
        type: 'container',
        props: { direction: 'column' },
        children: ['n_btn', 'n_list'],
      },
      {
        id: 'n_btn',
        type: 'button',
        props: {
          text: '提交',
          disabled: { type: 'expression', value: 'user.loading' },
        },
        style: { marginTop: { type: 'static', value: '8px' } },
        events: {
          click: [
            { id: 'a1', kind: 'setProp', config: { nodeId: 'n_btn', prop: 'text', value: '已提交' } },
            { id: 'a2', kind: 'openDialog', config: { dialogId: 'dialog1' } },
          ],
        },
      },
      {
        id: 'n_list',
        type: 'text',
        props: { text: { type: 'expression', value: '"用户数：" + count($datasource.userList.data)' } },
        bindings: {
          visible: { type: 'expression', value: 'count($datasource.userList.data) > 0' },
          loop: {
            type: 'static',
            value: { source: '$datasource.userList.data', itemName: 'item', indexName: 'index' },
          },
        },
      },
    ],
    materials: [],
    dataSources: [
      {
        id: 'userList',
        name: '用户列表',
        type: 'rest',
        config: { url: '/api/users' },
      },
    ],
    variables: [],
    rules: [],
  }
}

describe('Codegen 代码生成', () => {
  it('生成包含 v-if / v-for / @click / :style 的 SFC', async () => {
    const { code } = await generateVueSfc(makeSchema())
    expect(code).toContain('v-if=')
    expect(code).toContain('v-for=')
    expect(code).toContain('@click=')
    expect(code).toContain(':style=')
    expect(code).toContain(':disabled=')
    expect(code).toContain('loadUserList')
  })

  it('生成的代码可以通过 @vue/compiler-sfc 解析', async () => {
    const { code } = await generateVueSfc(makeSchema())
    const { descriptor, errors } = parse(code, { filename: 'page.vue' })
    expect(errors).toHaveLength(0)
    expect(descriptor.template).not.toBeNull()
    expect(descriptor.scriptSetup).not.toBeNull()
  })

  it('表达式重写 $datasource 与 $page 引用', () => {
    expect(rewriteExpression('$datasource.userList.data[0].name', ['userList'], [])).toBe(
      'userList[0].name',
    )
    expect(rewriteExpression('$page.status', [], ['status'])).toBe('status')
  })

  it('表达式重写不污染前缀冲突的数据源 id', () => {
    const ids = ['users', 'users2']
    expect(rewriteExpression('$datasource.users2.data + $datasource.users.data', ids, [])).toBe(
      'users2 + users',
    )
    expect(rewriteExpression('$datasource.users2.status', ids, [])).toBe('users2State.status')
    expect(rewriteExpression('$datasource.users.status', ids, [])).toBe('usersState.status')
  })

  it('未知物料生成注释占位而非损坏标签', async () => {
    const schema = makeSchema()
    schema.nodes.push({ id: 'n_unknown', type: 'my-custom-card', props: {} })
    const { code } = await generateVueSfc(schema)
    expect(code).toContain('未注册物料')
    expect(code).not.toContain('<LcMyCustomCard')
  })

  it('注入自定义物料映射可生成对应组件导入', async () => {
    const schema = makeSchema()
    schema.nodes.push({
      id: 'n_custom',
      type: 'my-card',
      props: { title: '自定义卡片' },
    })
    const { code } = await new VueSfcGenerator({
      materials: {
        'my-card': { importName: 'MyCard', from: '@my-pkg/cards' },
      },
    }).generate(schema)
    expect(code).toMatch(/import \{ MyCard \} from ['"]@my-pkg\/cards['"]/)
    expect(code).toContain('<MyCard')
  })
})
