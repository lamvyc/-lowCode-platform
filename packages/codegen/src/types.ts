/** 代码生成告警：生成器知道无法 1:1 还原的能力，显式暴露给 SFC 对话框 */
export interface CodegenWarning {
  /** 稳定标识，便于测试与去重：unknown-material / model-key / invalid-pattern / ... */
  code: string
  message: string
  nodeId?: string
}

/** 解析并补全后的表单设置（名字已转成合法标识符） */
export interface ResolvedForm {
  modelName: string
  refName: string
  rulesName: string
  labelPosition: 'left' | 'top'
  labelAlign: 'left' | 'center' | 'right'
  labelWidth: number
  size: 'large' | 'default' | 'small'
  customClass: string[]
  cssCode: string
  functions: string
}

/** 生成结果：完整 SFC + 各页签内容 + 告警 */
export interface GeneratedCode {
  filename: string
  code: string
  template: string
  script: string
  style: string
  warnings: CodegenWarning[]
}
