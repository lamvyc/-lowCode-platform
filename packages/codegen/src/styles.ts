import {
  getFormSettings,
  isExpressionBinding,
  isStaticBinding,
  type PageNode,
} from '@lowcode/schema'
import { rewriteExpression } from './expressions'
import type { MappingContext } from './mappings/types'
import type { CodegenPlan } from './plan'

/**
 * 生成页排版基线：从 materials 的 FormItem / Button / Card / Grid /
 * LayoutTable / Tab 实现抽取，保证独立页与画布的主要排版一致。
 * 复杂组件（上传/富文本/数据表格）只保证结构，不承诺逐像素。
 */
export const BASE_STYLE = `.lc-page :deep(.el-form-item) {
  margin-bottom: 22px;
}

.lc-page :deep(.el-form-item__label) {
  font-size: 14px;
  line-height: 36px;
  padding-right: 12px;
  color: #606266;
}

.lc-page :deep(.el-form-item__content) {
  line-height: 36px;
}

.lc-page :deep(.el-form-item__error) {
  font-size: 12px;
  padding-top: 2px;
}

.lc-page :deep(.el-button:not(.el-button--small):not(.el-button--large)) {
  font-size: 12px;
  padding: 9px 15px;
  border-radius: 3px;
}

.lc-page :deep(.el-card) {
  margin: 3px;
  overflow: visible;
}

.lc-page :deep(.el-card__header) {
  padding: 10px 12px;
}

.lc-page :deep(.el-row) {
  min-height: 50px;
}

.lc-page :deep(.el-tabs) {
  margin: 2px;
}

.lc-page :deep(.lc-layout-table table) {
  width: 100%;
  border-collapse: collapse;
}

.lc-page :deep(.lc-layout-table td) {
  height: 36px;
  border: 1px solid #e1e2e3;
}

.lc-page :deep(.lc-layout-table--border td) {
  border: 1px solid #d9d9d9;
}`

/** 节点 style → 模板 :style 表达式（对象字面量），无样式返回 undefined */
export function buildNodeStyle(node: PageNode, ctx: MappingContext): string | undefined {
  const entries: string[] = []
  for (const [key, binding] of Object.entries(node.style ?? {})) {
    const styleKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
    if (isExpressionBinding(binding)) {
      entries.push(
        `${styleKey}: ${rewriteExpression(
          binding.value,
          ctx.datasourceIds,
          ctx.variableNames,
          'template',
        )}`,
      )
    } else if (isStaticBinding(binding)) {
      entries.push(`${styleKey}: ${JSON.stringify(binding.value)}`)
    }
  }
  return entries.length > 0 ? `{ ${entries.join(', ')} }` : undefined
}

/** 节点自定义类名（node.props.class）与映射自带 class 合并去重 */
export function buildNodeClass(node: PageNode, mappingClass?: string): string | undefined {
  const classes: string[] = []
  const push = (value: unknown): void => {
    if (typeof value === 'string' && value.trim() !== '') {
      for (const item of value.trim().split(/\s+/)) {
        if (item !== '' && !classes.includes(item)) classes.push(item)
      }
    }
  }
  push(mappingClass)
  const custom = node.props.class
  if (Array.isArray(custom)) {
    for (const item of custom) push(item)
  } else {
    push(custom)
  }
  return classes.length > 0 ? classes.join(' ') : undefined
}

/** SFC 的 style 块：scoped 放排版基线，global 放页面 reset + 表单自定义 CSS */
export function buildStyleBlock(plan: CodegenPlan): { scoped: string; global: string } {
  const form = getFormSettings(plan.schema.settings)
  const custom = (form.cssCode ?? '').trim()
  return {
    scoped: BASE_STYLE,
    global: `.lc-page {
  box-sizing: border-box;
}${custom ? `\n\n${custom}` : ''}`,
  }
}
