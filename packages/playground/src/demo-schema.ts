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
        id: 'n_title',
        type: 'static-text',
        props: {
          textContent: '用户管理',
          fontSize: '20px',
          textAlign: 'left',
          class: ['lc-demo-highlight'],
        },
        style: {
          fontWeight: { type: 'static', value: 700 },
          color: { type: 'static', value: '#1f2329' },
        },
      },
      {
        id: 'n_select',
        type: 'select',
        props: {
          label: '筛选条件',
          modelValue: 'option1',
          placeholder: '请选择筛选条件',
          optionItems: [
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
        props: {
          label: '自定义筛选',
          modelValue: '',
          placeholder: '请输入自定义筛选',
          clearable: true,
          maxLength: 32,
          showWordLimit: true,
        },
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
        props: { text: '刷新列表', type: 'primary', size: 'default', disabled: false },
        events: {
          click: [
            {
              id: 'a_click_1',
              kind: 'setProp',
              label: '修改按钮文案',
              config: { nodeId: 'n_button', prop: 'text', value: '已刷新' },
            },
            {
              id: 'a_click_2',
              kind: 'emitEvent',
              label: '派发刷新事件',
              config: { event: 'refreshUserList', payload: {} },
            },
          ],
        },
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
    settings: {
      form: {
        size: 'default',
        labelPosition: 'left',
        labelAlign: 'left',
        labelWidth: 80,
        customClass: ['lc-demo-page'],
        cssCode: [
          '/* 表单自定义 CSS：类名可在「组件设置 → 自定义类名」中引用 */',
          '.lc-demo-page {',
          '  /* 这里演示 customClass + 自定义 CSS 的能力。',
          '     不要加 max-width 收窄：会让 demo 表单比参考实现窄，失去可比性。 */',
          '  padding: 0 0 8px;',
          '}',
          '',
          '.lc-demo-highlight {',
          '  padding-left: 10px;',
          '  border-left: 3px solid #3370ff;',
          '}',
        ].join('\n'),
        functions: ['function formatCity(city) {', "  return city ? `${city}市` : '-'", '}'].join('\n'),
        modelName: 'userForm',
        refName: 'userFormRef',
        rulesName: 'userFormRules',
        onFormMounted: "// 表单挂载完成后可在此加载初始数据\nconsole.log('form mounted')",
      },
    },
  }
}
