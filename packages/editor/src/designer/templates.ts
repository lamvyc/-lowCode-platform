import { shallowRef } from 'vue'
import {
  SCHEMA_VERSION,
  type AnyPageSchema,
  type FormSettings,
  type PageNode,
  type PageSchema,
} from '@lowcode/schema'
import { REFERENCE_FORM_PRESETS } from './template-presets'

/** 页面模板：工厂函数返回全新 Schema，避免多处共享同一份可变对象 */
export interface PageTemplate {
  id: string
  name: string
  description?: string
  tags?: string[]
  /** 内置模板标记（内置模板不允许在设计器中删除） */
  builtin?: boolean
  /** 每次调用都返回一份全新的页面 Schema */
  create: () => AnyPageSchema
}

function page(
  id: string,
  name: string,
  description: string,
  nodes: PageNode[],
  extra: Partial<Pick<PageSchema, 'dataSources' | 'variables'>> & {
    form?: Partial<FormSettings>
    cssCode?: string
  } = {},
): PageSchema {
  const now = new Date().toISOString()
  return {
    version: SCHEMA_VERSION,
    meta: { id, name, description, createdAt: now, updatedAt: now },
    // 模板实例必须是独立对象：预设数据是模块级常量，直接引用会让不同页面互相污染
    nodes: JSON.parse(JSON.stringify(nodes)) as PageNode[],
    materials: [],
    dataSources: JSON.parse(JSON.stringify(extra.dataSources ?? [])) as PageSchema['dataSources'],
    variables: JSON.parse(JSON.stringify(extra.variables ?? [])) as PageSchema['variables'],
    rules: [],
    settings: {
      layout: { mode: 'free' },
      form: {
        labelPosition: 'top',
        labelWidth: 100,
        labelAlign: 'left',
        size: 'default',
        customClass: [],
        cssCode: extra.cssCode ?? '',
        ...extra.form,
      },
    },
  }
}

/** 内置页面模板（离线可用，不依赖远程 JSON / 图片） */
export const BUILTIN_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    name: '空白页面',
    description: '空画布，适合从零搭建',
    tags: ['基础'],
    create: () => page('tpl_blank', '空白页面', '空白页面模板', []),
  },
  // 参考 variant-form 的 8 个表单模板（单列 / 多列 / 分组 / 标签页 / 主从 / 响应式 / 问卷 / 固定表格）
  ...REFERENCE_FORM_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    tags: preset.tags,
    create: () =>
      page(`tpl_${preset.id}`, preset.name, preset.description, preset.nodes, {
        form: preset.form,
        cssCode: preset.cssCode,
      }),
  })),
  {
    id: 'login',
    name: '登录表单',
    description: '账号 + 密码 + 登录按钮，含点击动作链',
    tags: ['表单', '常用'],
    create: () =>
      page('tpl_login', '登录表单', '登录表单模板', [
        {
          id: 'tpl_login_card',
          name: 'loginCard',
          type: 'card',
          props: { label: '账号登录', width: '420px' },
          children: ['tpl_login_account', 'tpl_login_password', 'tpl_login_submit'],
        },
        {
          id: 'tpl_login_account',
          name: 'account',
          type: 'input',
          props: {
            modelValue: '',
            type: 'text',
            placeholder: '请输入账号',
            clearable: true,
            maxLength: 32,
            showWordLimit: true,
          },
        },
        {
          id: 'tpl_login_password',
          name: 'password',
          type: 'input',
          props: {
            modelValue: '',
            type: 'password',
            placeholder: '请输入密码',
            clearable: true,
          },
        },
        {
          id: 'tpl_login_submit',
          name: 'submit',
          type: 'button',
          props: { text: '登录', type: 'primary', size: 'default' },
          events: {
            click: [
              {
                id: 'tpl_login_submit_action',
                kind: 'emitEvent',
                label: '派发登录事件',
                config: { event: 'login', payload: {} },
              },
            ],
          },
        },
      ]),
  },
  {
    id: 'list',
    name: '数据列表页',
    description: '数据源表格 + 操作按钮 + 详情弹窗',
    tags: ['数据', '常用'],
    create: () =>
      page(
        'tpl_list',
        '数据列表页',
        '数据列表页模板',
        [
          {
            id: 'tpl_list_title',
            name: 'title',
            type: 'static-text',
            props: { textContent: '用户列表', fontSize: '20px', textAlign: 'left' },
            style: { fontWeight: { type: 'static', value: 700 } },
          },
          {
            id: 'tpl_list_table',
            name: 'userTable',
            type: 'table',
            props: {
              data: { type: 'expression', value: '$datasource.userList.data' },
              columns: [
                { prop: 'name', label: '姓名', width: 120 },
                { prop: 'age', label: '年龄', width: 80 },
                { prop: 'city', label: '城市', width: 120 },
              ],
              stripe: true,
              border: true,
            },
          },
          {
            id: 'tpl_list_refresh',
            name: 'refreshList',
            type: 'button',
            props: { text: '刷新列表', type: 'primary', size: 'default' },
            events: {
              click: [
                {
                  id: 'tpl_list_refresh_action',
                  kind: 'emitEvent',
                  label: '派发刷新事件',
                  config: { event: 'refreshList', payload: {} },
                },
              ],
            },
          },
        ],
        {
          dataSources: [
            {
              id: 'userList',
              name: '用户列表',
              type: 'static',
              config: {
                staticData: {
                  data: [
                    { name: '张三', age: 28, city: '上海' },
                    { name: '李四', age: 32, city: '北京' },
                  ],
                },
              },
              autoLoad: true,
            },
          ],
        },
      ),
  },
  {
    id: 'dashboard',
    name: '卡片看板',
    description: '横向排列的指标卡片，演示容器与卡片嵌套',
    tags: ['布局'],
    create: () =>
      page('tpl_dashboard', '卡片看板', '卡片看板模板', [
        {
          id: 'tpl_dash_title',
          name: 'title',
          type: 'static-text',
          props: { textContent: '运营看板', fontSize: '20px', textAlign: 'left' },
          style: { fontWeight: { type: 'static', value: 700 } },
        },
        {
          id: 'tpl_dash_grid',
          name: 'cardsGrid',
          type: 'grid',
          props: { gutter: 12, justify: 'start' },
          children: ['tpl_dash_col_a', 'tpl_dash_col_b'],
        },
        {
          id: 'tpl_dash_col_a',
          name: 'colA',
          type: 'grid-col',
          props: { span: 12 },
          children: ['tpl_dash_card_a'],
        },
        {
          id: 'tpl_dash_card_a',
          name: 'cardA',
          type: 'card',
          props: { label: '今日访问', width: '100%' },
          children: ['tpl_dash_value_a'],
        },
        {
          id: 'tpl_dash_value_a',
          name: 'valueA',
          type: 'static-text',
          props: { textContent: '1,286', fontSize: '28px', textAlign: 'left' },
          style: {
            fontWeight: { type: 'static', value: 700 },
            color: { type: 'static', value: '#3370ff' },
          },
        },
        {
          id: 'tpl_dash_col_b',
          name: 'colB',
          type: 'grid-col',
          props: { span: 12 },
          children: ['tpl_dash_card_b'],
        },
        {
          id: 'tpl_dash_card_b',
          name: 'cardB',
          type: 'card',
          props: { label: '转化率', width: '100%' },
          children: ['tpl_dash_value_b'],
        },
        {
          id: 'tpl_dash_value_b',
          name: 'valueB',
          type: 'static-text',
          props: { textContent: '36.8%', fontSize: '28px', textAlign: 'left' },
          style: {
            fontWeight: { type: 'static', value: 700 },
            color: { type: 'static', value: '#00b42a' },
          },
        },
      ]),
  },
]

/** 模板注册表：编辑器内置模板 + 外部（playground / 插件）注册的模板 */
export class TemplateRegistry {
  private readonly items = shallowRef<PageTemplate[]>([])

  register(template: PageTemplate): void {
    if (this.items.value.some((item) => item.id === template.id)) return
    this.items.value = [...this.items.value, template]
  }

  registerMany(templates: PageTemplate[]): void {
    for (const template of templates) this.register(template)
  }

  /** 读取模板列表（在 computed 中调用可保持响应式） */
  list(): PageTemplate[] {
    return this.items.value
  }

  get(id: string): PageTemplate | undefined {
    return this.items.value.find((item) => item.id === id)
  }

  remove(id: string): void {
    this.items.value = this.items.value.filter((item) => item.id !== id)
  }

  /** 载入模板：深拷贝出一份全新 Schema */
  instantiate(id: string): AnyPageSchema | undefined {
    const template = this.get(id)
    if (!template) return undefined
    return JSON.parse(JSON.stringify(template.create())) as AnyPageSchema
  }
}

export const templateRegistry = new TemplateRegistry()

let builtinsRegistered = false

/** 注册内置模板（幂等） */
export function registerBuiltinTemplates(): void {
  if (builtinsRegistered) return
  builtinsRegistered = true
  templateRegistry.registerMany(BUILTIN_TEMPLATES.map((template) => ({ ...template, builtin: true })))
}
