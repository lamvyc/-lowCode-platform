import type {
  FormLabelAlign,
  FormLabelPosition,
  FormSettings,
  FormSize,
  PageSettings,
} from './types/page'

/** 表单设置默认值：未声明的字段一律回落到这里 */
export const DEFAULT_FORM_SETTINGS: FormSettings = {
  size: 'default',
  labelPosition: 'top',
  labelAlign: 'left',
  labelWidth: 100,
  customClass: [],
  cssCode: '',
  functions: '',
  modelName: 'formData',
  refName: 'formRef',
  rulesName: 'formRules',
}

/** 表单尺寸可选项 */
export const FORM_SIZE_OPTIONS: ReadonlyArray<{ label: string; value: FormSize }> = [
  { label: '大', value: 'large' },
  { label: '默认', value: 'default' },
  { label: '小', value: 'small' },
]

/** 标签位置可选项 */
export const FORM_LABEL_POSITION_OPTIONS: ReadonlyArray<{
  label: string
  value: FormLabelPosition
}> = [
  { label: '左侧', value: 'left' },
  { label: '顶部', value: 'top' },
]

/** 标签对齐可选项 */
export const FORM_LABEL_ALIGN_OPTIONS: ReadonlyArray<{
  label: string
  value: FormLabelAlign
}> = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]

/** 表单事件声明：驱动「表单设置 → 事件设置」分区 */
export interface FormEventConfig {
  name: 'onFormCreated' | 'onFormMounted' | 'onFormDataChange'
  label: string
  /** 事件签名参数名（仅用于对话框头部提示） */
  params: string[]
  description: string
}

/** 表单级事件清单 */
export const FORM_EVENT_CONFIGS: readonly FormEventConfig[] = [
  {
    name: 'onFormCreated',
    label: 'onFormCreated',
    params: [],
    description: '表单创建完成时触发（此时表单实例已可用）',
  },
  {
    name: 'onFormMounted',
    label: 'onFormMounted',
    params: [],
    description: '表单挂载完成后触发（适合做初始数据加载）',
  },
  {
    name: 'onFormDataChange',
    label: 'onFormDataChange',
    params: ['fieldName', 'newValue', 'oldValue', 'formModel'],
    description: '表单数据变化时触发',
  },
]

/** 补全表单设置默认值（返回新对象，不修改入参） */
export function normalizeFormSettings(input?: FormSettings | null): FormSettings {
  return {
    ...DEFAULT_FORM_SETTINGS,
    ...(input ?? {}),
    customClass: [...(input?.customClass ?? DEFAULT_FORM_SETTINGS.customClass ?? [])],
  }
}

/** 从页面 settings 中读取已补全默认值的表单设置 */
export function getFormSettings(settings?: PageSettings | null): FormSettings {
  return normalizeFormSettings(settings?.form)
}

/**
 * 提取 CSS 代码中的类名（供「自定义类名」下拉复用）。
 * 支持 `.a {`、`.a, .b {`、`.a .b {`、`.a:hover {` 等常见写法。
 */
export function extractCssClassNames(css: string | undefined | null): string[] {
  if (!css) return []
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const names = new Set<string>()
  // 只扫描选择器部分（`{` 之前），避免把声明块中的内容误判为类名
  const selectorPattern = /([^{}]+)\{/g
  let selectorMatch: RegExpExecArray | null
  while ((selectorMatch = selectorPattern.exec(withoutComments)) !== null) {
    const classPattern = /\.(-?[_a-zA-Z][\w-]*)/g
    let classMatch: RegExpExecArray | null
    while ((classMatch = classPattern.exec(selectorMatch[1])) !== null) {
      names.add(classMatch[1])
    }
  }
  return [...names]
}
