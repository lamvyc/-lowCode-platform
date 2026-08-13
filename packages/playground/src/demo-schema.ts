import { SCHEMA_VERSION, type PageSchema } from '@lowcode/schema'

/** 演示页面：数据源驱动的表格 + Select 联动 Input + 按钮动作链 + 弹窗 */
export function createDemoSchema(): PageSchema {
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: 'demo',
      name: '用户管理示例',
      description: '数据源 / 表达式绑定 / 动作链 / 弹窗 的完整演示',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      route: '/demo',
    },
    nodes: [
      {
        id: 'root',
        type: 'container',
        props: { direction: 'column', gap: 12, padding: 16, backgroundColor: '' },
        children: ['n_title', 'n_select', 'n_input', 'n_table', 'n_button', 'n_dialog'],
      },
      {
        id: 'n_title',
        type: 'text',
        props: { text: '用户管理', fontSize: 20, bold: true, color: '#1f2329', align: 'left' },
      },
      {
        id: 'n_select',
        type: 'select',
        props: {
          modelValue: 'option1',
          placeholder: '请选择筛选条件',
          options: [
            { label: '全部用户', value: 'option1' },
            { label: '其他', value: '其他' },
          ],
          disabled: false,
        },
        events: {
          change: [
            {
              id: 'a_select',
              kind: 'setVariable',
              label: '同步筛选值',
              config: { name: 'selectValue', expression: 'event' },
            },
          ],
        },
      },
      {
        id: 'n_input',
        type: 'input',
        props: { modelValue: '', placeholder: '请输入自定义筛选', clearable: true, disabled: false },
        bindings: {
          visible: { type: 'expression', value: 'selectValue === "其他"' },
        },
      },
      {
        id: 'n_table',
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
        id: 'n_button',
        type: 'button',
        props: { text: '打开详情', type: 'primary', size: 'default', disabled: false },
        events: {
          click: [
            {
              id: 'a_click_1',
              kind: 'setProp',
              label: '修改按钮文案',
              config: { nodeId: 'n_button', prop: 'text', value: '已打开详情' },
            },
            {
              id: 'a_click_2',
              kind: 'openDialog',
              label: '打开弹窗',
              config: { dialogId: 'dialog1' },
            },
          ],
        },
      },
      {
        id: 'n_dialog',
        type: 'dialog',
        props: { dialogId: 'dialog1', title: '详情弹窗', width: '420px' },
        children: ['n_dialog_text'],
      },
      {
        id: 'n_dialog_text',
        type: 'text',
        props: { text: '这是通过 openDialog 动作打开的弹窗', fontSize: 14, color: '#4e5969' },
      },
    ],
    materials: [],
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
              { name: '王五', age: 25, city: '深圳' },
            ],
          },
        },
        autoLoad: true,
      },
    ],
    variables: [
      { id: 'v_select', name: 'selectValue', value: 'option1' },
      { id: 'v_input', name: 'inputValue', value: '' },
    ],
    rules: [],
  }
}
