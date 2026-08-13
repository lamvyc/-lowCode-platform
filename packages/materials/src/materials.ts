import type { Material } from '@lowcode/schema'
import Text from './components/Text.vue'
import Button from './components/Button.vue'
import Input from './components/Input.vue'
import Select from './components/Select.vue'
import Image from './components/Image.vue'
import Container from './components/Container.vue'
import Table from './components/Table.vue'
import Dialog from './components/Dialog.vue'

/** 本地物料清单：组件 + 默认属性 + 属性面板配置 */
export const LOCAL_MATERIALS: Material[] = [
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
    defaultProps: {
      direction: 'column',
      gap: 8,
      padding: 12,
      backgroundColor: '',
      align: 'stretch',
      justify: 'flex-start',
    },
    propConfigs: [
      {
        name: 'direction',
        label: '方向',
        control: 'select',
        options: [
          { label: '纵向', value: 'column' },
          { label: '横向', value: 'row' },
        ],
        defaultValue: 'column',
      },
      { name: 'gap', label: '间距', control: 'number', defaultValue: 8 },
      { name: 'padding', label: '内边距', control: 'number', defaultValue: 12 },
      { name: 'backgroundColor', label: '背景色', control: 'color', defaultValue: '' },
      {
        name: 'align',
        label: '对齐',
        control: 'select',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '居中', value: 'center' },
          { label: '起始', value: 'flex-start' },
          { label: '末尾', value: 'flex-end' },
        ],
        defaultValue: 'stretch',
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
    defaultProps: { text: '文本', color: '', fontSize: 14, bold: false, align: 'left' },
    propConfigs: [
      { name: 'text', label: '内容', control: 'input', defaultValue: '文本' },
      { name: 'color', label: '文字颜色', control: 'color', defaultValue: '' },
      { name: 'fontSize', label: '字号', control: 'number', defaultValue: 14 },
      { name: 'bold', label: '加粗', control: 'switch', defaultValue: false },
      {
        name: 'align',
        label: '对齐',
        control: 'select',
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
    defaultProps: { text: '按钮', type: 'primary', size: 'default', disabled: false },
    propConfigs: [
      { name: 'text', label: '文案', control: 'input', defaultValue: '按钮' },
      {
        name: 'type',
        label: '类型',
        control: 'select',
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
        control: 'select',
        options: [
          { label: '小', value: 'small' },
          { label: '默认', value: 'default' },
          { label: '大', value: 'large' },
        ],
        defaultValue: 'default',
      },
      { name: 'disabled', label: '禁用', control: 'switch', defaultValue: false },
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
    defaultProps: { modelValue: '', placeholder: '请输入', clearable: true, disabled: false },
    propConfigs: [
      { name: 'modelValue', label: '值', control: 'input', defaultValue: '' },
      { name: 'placeholder', label: '占位符', control: 'input', defaultValue: '请输入' },
      { name: 'clearable', label: '可清空', control: 'switch', defaultValue: true },
      { name: 'disabled', label: '禁用', control: 'switch', defaultValue: false },
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
    defaultProps: {
      modelValue: '',
      placeholder: '请选择',
      options: [
        { label: '选项一', value: 'option1' },
        { label: '其他', value: '其他' },
      ],
      disabled: false,
    },
    propConfigs: [
      { name: 'modelValue', label: '值', control: 'input', defaultValue: '' },
      { name: 'placeholder', label: '占位符', control: 'input', defaultValue: '请选择' },
      {
        name: 'options',
        label: '选项',
        control: 'json',
        defaultValue: [
          { label: '选项一', value: 'option1' },
          { label: '其他', value: '其他' },
        ],
      },
      { name: 'disabled', label: '禁用', control: 'switch', defaultValue: false },
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
    defaultProps: {
      src: 'https://picsum.photos/200/120',
      alt: '',
      width: 200,
      height: 120,
    },
    propConfigs: [
      { name: 'src', label: '图片地址', control: 'input', defaultValue: '' },
      { name: 'alt', label: '替代文本', control: 'input', defaultValue: '' },
      { name: 'width', label: '宽度', control: 'number', defaultValue: 200 },
      { name: 'height', label: '高度', control: 'number', defaultValue: 120 },
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
      {
        name: 'data',
        label: '数据',
        control: 'expression',
        defaultValue: '$datasource.userList.data',
      },
      {
        name: 'columns',
        label: '列配置',
        control: 'json',
        defaultValue: [
          { prop: 'name', label: '姓名', width: 120 },
          { prop: 'age', label: '年龄', width: 80 },
        ],
      },
      { name: 'stripe', label: '斑马纹', control: 'switch', defaultValue: true },
      { name: 'border', label: '边框', control: 'switch', defaultValue: true },
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
    defaultProps: { dialogId: 'dialog1', title: '弹窗', width: '480px' },
    propConfigs: [
      { name: 'dialogId', label: '弹窗 ID', control: 'input', defaultValue: 'dialog1' },
      { name: 'title', label: '标题', control: 'input', defaultValue: '弹窗' },
      { name: 'width', label: '宽度', control: 'input', defaultValue: '480px' },
    ],
  },
]
