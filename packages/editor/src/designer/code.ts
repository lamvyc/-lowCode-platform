/** 代码编辑器支持的语法模式 */
export type CodeMode = 'javascript' | 'css' | 'json' | 'html'

/** 代码静态检查结果 */
export interface CodeAnnotation {
  type: 'error' | 'warning'
  message: string
  /** 1-based 行号（无法定位时省略） */
  line?: number
}

/** 从 SyntaxError 堆栈/消息中尽量解析行号 */
function lineFromError(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error)
  // V8: "<anonymous>:3:5"（new Function 会整体上移一行，需回退）
  const match = message.match(/<anonymous>:(\d+):\d+/)
  if (!match) return undefined
  const line = Number(match[1])
  return line > 1 ? line - 1 : undefined
}

/** CSS 花括号配平检查（足够覆盖设计器中的样式片段） */
function validateCss(code: string): CodeAnnotation[] {
  const annotations: CodeAnnotation[] = []
  let depth = 0
  let line = 1
  for (const char of code) {
    if (char === '\n') line += 1
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth < 0) {
        annotations.push({ type: 'error', message: '多余的右花括号 }', line })
        return annotations
      }
    }
  }
  if (depth > 0) {
    annotations.push({ type: 'error', message: `缺少 ${depth} 个右花括号 }` })
  }
  return annotations
}

/**
 * 静态检查代码：仅做语法级校验，不执行用户代码。
 * - javascript：`new Function` 解析函数体（允许 return）
 * - json：JSON.parse
 * - css：花括号配平
 */
export function validateCode(code: string, mode: CodeMode): CodeAnnotation[] {
  if (!code.trim()) return []
  switch (mode) {
    case 'javascript': {
      try {
        // eslint-disable-next-line no-new-func
        new Function(code)
        return []
      } catch (error) {
        return [
          {
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            line: lineFromError(error),
          },
        ]
      }
    }
    case 'json': {
      try {
        JSON.parse(code)
        return []
      } catch (error) {
        return [
          { type: 'error', message: error instanceof Error ? error.message : String(error) },
        ]
      }
    }
    case 'css':
      return validateCss(code)
    default:
      return []
  }
}

/** 格式化代码：目前仅支持 JSON 美化，其余模式原样返回 */
export function formatCode(code: string, mode: CodeMode): string {
  if (mode !== 'json') return code
  try {
    return JSON.stringify(JSON.parse(code), null, 2)
  } catch {
    return code
  }
}

/** 模式展示名 */
export const CODE_MODE_LABELS: Record<CodeMode, string> = {
  javascript: 'JavaScript',
  css: 'CSS',
  json: 'JSON',
  html: 'HTML',
}

/** 模式对应的 textarea 占位提示 */
export const CODE_MODE_PLACEHOLDERS: Record<CodeMode, string> = {
  javascript: '// 在此编写函数体代码',
  css: '.my-class {\n  color: #3370ff;\n}',
  json: '{ "key": "value" }',
  html: '<div>...</div>',
}
