import type { Material, PropConfig } from '@lowcode/schema'
import Text from './components/Text.vue'
import Button from './components/Button.vue'
import Input from './components/Input.vue'
import Select from './components/Select.vue'
import Image from './components/Image.vue'
import Container from './components/Container.vue'
import Card from './components/Card.vue'
import Table from './components/Table.vue'
import Dialog from './components/Dialog.vue'

/**
 * 系统级属性配置：所有物料共用（唯一名称 / 标签 / 隐藏 / 样式 / 自定义类名）。
 * 它们不是组件 props，而是节点身份与节点级配置，由属性面板按 control 分派专用编辑器。
 */
function systemProps(options: { label?: boolean; style?: boolean; customClass?: boolean } = {}): PropConfig[] {
  const { label = false, style = true, customClass = true } = options
  const configs: PropConfig[] = [
    { name: 'name', label: '唯一名称', control: 'name', group: 'common', description: '组件在页面内的唯一标识，事件与数据绑定通过它引用' },
    ...(label ? [{ name: 'label', label: '标签', control: 'label', group: 'common', defaultValue: '' } as PropConfig] : []),
    { name: 'hidden', label: '隐藏', control: 'hidden', group: 'common', description: '隐藏后画布与运行时都不渲染，可用于调试' },
  ]
  if (style) {
    configs.push({
      name: 'style',
      label: '自定义样式',
      control: 'style',
      group: 'advanced',
      description: 'CSS 属性键值对，如 {"borderRadius":"8px"}',
    })
  }
  if (customClass) {
    configs.push({
      name: 'class',
      label: '自定义类名',
      control: 'custom-class',
      group: 'advanced',
      description: '取自「表单设置」中自定义 CSS 的类名',
    })
  }
  return configs
}

/** 本地物料清单：组件 + 默认属性 + 属性面板配置（分组 / 专用编辑器 / 联动） */
export const LOCAL_MATERIALS: Material[] = [
  {
    type: 'card',
    name: '卡片',
    category: '布局',
    icon: '▢',
    description: '带标题与折叠能力的容器',
    version: '1.0.0',
    droppable: true,
    groupable: true,
    slots: ['default'],
    component: Card,
    events: [{ name: 'click', label: 'onClick', params: ['event'], description: '点击卡片时触发' }],
    defaultProps: {
      label: '',
      collapsed: false,
      showCollapse: true,
      hideTitle: false,
      width: '100%',
    },
    propConfigs: [
      ...systemProps({ label: true }),
      { name: 'hideTitle', label: '隐藏标题区', control: 'switch', group: 'common', defaultValue: false },
      { name: 'showCollapse', label: '显示折叠按钮', control: 'switch', group: 'advanced', defaultValue: true },
      {
        name: 'collapsed',
        label: '默认收起',
        control: 'switch',
        group: 'advanced',
        defaultValue: false,
        visibleWhen: { prop: 'showCollapse', equals: true },
      },
      { name: 'width', label: '卡片宽度', control: 'input', group: 'advanced', defaultValue: '100%', placeholder: '如 100% / 320px' },
    ],
  },
  {
    type: 'container',
    name: '容器',
    category: '布局',
    icon: '▦',
    description: '可容纳子节点的弹性容器',
    version: '1.0.0',
    droppable: true,
    groupable: true,
    slots: ['default'],
    component: Container,
    events: [{ name: 'click', label: 'onClick', params: ['event'], description: '点击容器时触发' }],
    defaultProps: {
      direction: 'column',
      gap: 8,
      padding: 12,
      backgroundColor: '',
      align: 'stretch',
      justify: 'flex-start',
    },
    propConfigs: [
      ...systemProps(),
      {
        name: 'direction',
        label: '排列方向',
        control: 'radio-button',
        group: 'common',
        options: [
          { label: '纵向', value: 'column' },
          { label: '横向', value: 'row' },
        ],
        defaultValue: 'column',
      },
      {
        name: 'align',
        label: '交叉轴对齐',
        control: 'select',
        group: 'common',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '居中', value: 'center' },
          { label: '起始', value: 'flex-start' },
          { label: '末尾', value: 'flex-end' },
        ],
        defaultValue: 'stretch',
      },
      { name: 'gap', label: '子项间距', control: 'number', group: 'advanced', range: { min: 0, max: 80 }, defaultValue: 8 },
      { name: 'padding', label: '内边距', control: 'number', group: 'advanced', range: { min: 0, max: 80 }, defaultValue: 12 },
      { name: 'backgroundColor', label: '背景色', control: 'color', group: 'advanced', defaultValue: '' },
      {
        name: 'justify',
        label: '主轴对齐',
        control: 'select',
        group: 'advanced',
        options: [
          { label: '起始', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '末尾', value: 'flex-end' },
          { label: '两端对齐', value: 'space-between' },
          { label: '环绕', value: 'space-around' },
        ],
        defaultValue: 'flex-start',
      },
    ],
  },
  {
    type: 'text',
    name: '文本',
    category: '基础',
    icon: 'T',
    description: '展示文本内容',
    version: '1.0.0',
    component: Text,
    events: [{ name: 'click', label: 'onClick', params: ['event'], description: '点击文本时触发' }],
    defaultProps: { text: '文本', color: '', fontSize: 14, bold: false, align: 'left' },
    propConfigs: [
      ...systemProps({ label: false }),
      { name: 'text', label: '文本内容', control: 'textarea', group: 'common', defaultValue: '文本', placeholder: '请输入文本内容' },
      { name: 'fontSize', label: '字号', control: 'number', group: 'advanced', range: { min: 12, max: 72, step: 1 }, defaultValue: 14 },
      { name: 'color', label: '文字颜色', control: 'color', group: 'advanced', defaultValue: '' },
      { name: 'bold', label: '加粗', control: 'switch', group: 'advanced', defaultValue: false },
      {
        name: 'align',
        label: '对齐',
        control: 'radio-button',
        group: 'advanced',
        options: [
          { label: '左', value: 'left' },
          { label: '中', value: 'center' },
          { label: '右', value: 'right' },
        ],
        defaultValue: 'left',
      },
    ],
  },
  {
    type: 'button',
    name: '按钮',
    category: '基础',
    icon: '□',
    description: '触发事件与动作链',
    version: '1.0.0',
    component: Button,
    events: [{ name: 'click', label: 'onClick', params: ['event'], description: '点击按钮时触发动作链' }],
    defaultProps: { text: '按钮', type: 'primary', size: 'default', disabled: false, plain: false, round: false, circle: false },
    propConfigs: [
      ...systemProps({ label: false }),
      { name: 'text', label: '按钮文案', control: 'input', group: 'common', defaultValue: '按钮' },
      {
        name: 'type',
        label: '按钮类型',
        control: 'select',
        group: 'common',
        options: [
          { label: '主要', value: 'primary' },
          { label: '成功', value: 'success' },
          { label: '警告', value: 'warning' },
          { label: '危险', value: 'danger' },
          { label: '信息', value: 'info' },
          { label: '默认', value: 'default' },
        ],
        defaultValue: 'primary',
      },
      {
        name: 'size',
        label: '尺寸',
        control: 'radio-button',
        group: 'advanced',
        options: [
          { label: '小', value: 'small' },
          { label: '默认', value: 'default' },
          { label: '大', value: 'large' },
        ],
        defaultValue: 'default',
      },
      { name: 'plain', label: '朴素按钮', control: 'switch', group: 'advanced', defaultValue: false },
      { name: 'round', label: '圆角按钮', control: 'switch', group: 'advanced', defaultValue: false },
      {
        name: 'circle',
        label: '圆形按钮',
        control: 'switch',
        group: 'advanced',
        defaultValue: false,
        visibleWhen: { prop: 'round', equals: false },
      },
      { name: 'disabled', label: '禁用', control: 'switch', group: 'advanced', defaultValue: false },
    ],
  },
  {
    type: 'input',
    name: '输入框',
    category: '表单',
    icon: '▤',
    description: '文本输入',
    version: '1.0.0',
    component: Input,
    events: [
      { name: 'input', label: 'onInput', params: ['value'], description: '输入内容变化时触发' },
      { name: 'change', label: 'onChange', params: ['value'], description: '值确认（失焦或回车）时触发' },
      { name: 'focus', label: 'onFocus', params: ['event'], description: '获得焦点时触发' },
      { name: 'blur', label: 'onBlur', params: ['event'], description: '失去焦点时触发' },
    ],
    defaultProps: {
      modelValue: '',
      type: 'text',
      placeholder: '请输入',
      clearable: true,
      disabled: false,
      readonly: false,
      maxlength: 0,
      showWordLimit: false,
      rows: 3,
    },
    propConfigs: [
      ...systemProps(),
      {
        name: 'type',
        label: '输入类型',
        control: 'radio-button',
        group: 'common',
        options: [
          { label: '文本', value: 'text' },
          { label: '密码', value: 'password' },
          { label: '多行', value: 'textarea' },
        ],
        defaultValue: 'text',
      },
      { name: 'placeholder', label: '占位提示', control: 'input', group: 'common', defaultValue: '请输入' },
      {
        name: 'rows',
        label: '行数',
        control: 'number',
        group: 'common',
        range: { min: 1, max: 20 },
        defaultValue: 3,
        visibleWhen: { prop: 'type', equals: 'textarea' },
      },
      { name: 'maxlength', label: '最大长度', control: 'number', group: 'advanced', range: { min: 0, max: 2000 }, defaultValue: 0, description: '0 表示不限制' },
      {
        name: 'showWordLimit',
        label: '显示字数统计',
        control: 'switch',
        group: 'advanced',
        defaultValue: false,
        visibleWhen: { prop: 'maxlength', notEquals: 0 },
      },
      { name: 'clearable', label: '可清空', control: 'switch', group: 'advanced', defaultValue: true },
      { name: 'readonly', label: '只读', control: 'switch', group: 'advanced', defaultValue: false },
      { name: 'disabled', label: '禁用', control: 'switch', group: 'advanced', defaultValue: false },
    ],
  },
  {
    type: 'select',
    name: '下拉选择',
    category: '表单',
    icon: '▾',
    description: '下拉选择，change 事件可触发联动',
    version: '1.0.0',
    component: Select,
    events: [
      { name: 'change', label: 'onChange', params: ['value'], description: '选中项变化时触发' },
      { name: 'focus', label: 'onFocus', params: ['event'], description: '获得焦点时触发' },
      { name: 'blur', label: 'onBlur', params: ['event'], description: '失去焦点时触发' },
      { name: 'clear', label: 'onClear', params: [], description: '点击清空按钮时触发' },
    ],
    defaultProps: {
      modelValue: '',
      placeholder: '请选择',
      options: [
        { label: '选项一', value: 'option1' },
        { label: '其他', value: '其他' },
      ],
      disabled: false,
      clearable: true,
      filterable: false,
      multiple: false,
      multipleLimit: 0,
    },
    propConfigs: [
      ...systemProps(),
      { name: 'placeholder', label: '占位提示', control: 'input', group: 'common', defaultValue: '请选择' },
      {
        name: 'options',
        label: '选项',
        control: 'option-items',
        group: 'common',
        defaultValue: [
          { label: '选项一', value: 'option1' },
          { label: '其他', value: '其他' },
        ],
      },
      { name: 'multiple', label: '多选', control: 'switch', group: 'advanced', defaultValue: false },
      {
        name: 'multipleLimit',
        label: '最多可选',
        control: 'number',
        group: 'advanced',
        range: { min: 0, max: 50 },
        defaultValue: 0,
        description: '0 表示不限制',
        visibleWhen: { prop: 'multiple', equals: true },
      },
      { name: 'filterable', label: '可搜索', control: 'switch', group: 'advanced', defaultValue: false },
      { name: 'clearable', label: '可清空', control: 'switch', group: 'advanced', defaultValue: true },
      { name: 'disabled', label: '禁用', control: 'switch', group: 'advanced', defaultValue: false },
    ],
  },
  {
    type: 'image',
    name: '图片',
    category: '基础',
    icon: '◫',
    description: '展示图片',
    version: '1.0.0',
    component: Image,
    events: [
      { name: 'click', label: 'onClick', params: ['event'], description: '点击图片时触发' },
      { name: 'error', label: 'onError', params: ['event'], description: '图片加载失败时触发' },
    ],
    defaultProps: {
      src: 'https://picsum.photos/200/120',
      alt: '',
      width: 200,
      height: 120,
    },
    propConfigs: [
      ...systemProps({ label: false }),
      { name: 'src', label: '图片地址', control: 'input', group: 'common', defaultValue: '', placeholder: 'https://...' },
      { name: 'alt', label: '替代文本', control: 'input', group: 'advanced', defaultValue: '' },
      { name: 'width', label: '宽度', control: 'number', group: 'advanced', range: { min: 10, max: 2000 }, defaultValue: 200 },
      { name: 'height', label: '高度', control: 'number', group: 'advanced', range: { min: 10, max: 2000 }, defaultValue: 120 },
    ],
  },
  {
    type: 'table',
    name: '表格',
    category: '数据',
    icon: '☰',
    description: '数据源驱动的表格',
    version: '1.0.0',
    component: Table,
    defaultProps: {
      data: { type: 'expression', value: '$datasource.userList.data' },
      columns: [
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'age', label: '年龄', width: 80 },
      ],
      stripe: true,
      border: true,
    },
    propConfigs: [
      ...systemProps(),
      {
        name: 'data',
        label: '数据',
        control: 'expression',
        group: 'common',
        defaultValue: '$datasource.userList.data',
        description: '表达式绑定，如 $datasource.userList.data',
      },
      {
        name: 'columns',
        label: '列配置',
        control: 'json',
        group: 'advanced',
        defaultValue: [
          { prop: 'name', label: '姓名', width: 120 },
          { prop: 'age', label: '年龄', width: 80 },
        ],
        description: '列数组：[{ prop, label, width }]',
      },
      { name: 'stripe', label: '斑马纹', control: 'switch', group: 'advanced', defaultValue: true },
      { name: 'border', label: '边框', control: 'switch', group: 'advanced', defaultValue: true },
    ],
  },
  {
    type: 'dialog',
    name: '弹窗',
    category: '反馈',
    icon: '▣',
    description: '由 openDialog / closeDialog 动作控制',
    version: '1.0.0',
    droppable: true,
    groupable: true,
    slots: ['default'],
    component: Dialog,
    events: [
      { name: 'open', label: 'onOpen', params: [], description: '弹窗打开时触发' },
      { name: 'close', label: 'onClose', params: [], description: '弹窗关闭时触发' },
    ],
    defaultProps: { dialogId: 'dialog1', title: '弹窗', width: '480px' },
    propConfigs: [
      ...systemProps(),
      { name: 'dialogId', label: '弹窗 ID', control: 'input', group: 'common', defaultValue: 'dialog1', description: 'openDialog 动作通过该 ID 定位弹窗' },
      { name: 'title', label: '标题', control: 'input', group: 'common', defaultValue: '弹窗' },
      { name: 'width', label: '宽度', control: 'input', group: 'advanced', defaultValue: '480px' },
    ],
  },
]
