import type { PageSchema } from '@lowcode/schema'
import { datasourceRefName } from './expressions'
import { sanitizeIdentifier } from './plan'
import type { CodegenWarning } from './types'

/** 数据源 id → loader 函数名 */
export function dataSourceLoadName(id: string): string {
  const sanitized = sanitizeIdentifier(id, 'ds')
  return `load${sanitized.charAt(0).toUpperCase()}${sanitized.slice(1)}`
}

export interface DataSourceRuntime {
  lines: string[]
  mountCalls: string[]
  cleanupLines: string[]
  warnings: CodegenWarning[]
}

function quote(value: unknown): string {
  return JSON.stringify(value)
}

function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    search.set(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** 生成数据源 ref / loader / 自动加载与清理信息 */
export function buildDataSourceRuntime(schema: PageSchema): DataSourceRuntime {
  const lines: string[] = []
  const mountCalls: string[] = []
  const cleanupLines: string[] = []
  const warnings: CodegenWarning[] = []
  const variableRefs = new Map(
    schema.variables.map((variable) => [
      variable.name,
      sanitizeIdentifier(variable.name, 'variable'),
    ]),
  )

  for (const source of schema.dataSources) {
    const refName = datasourceRefName(source.id)
    if (source.enabled === false) {
      lines.push(`const ${refName} = ref(null)`)
      continue
    }

    switch (source.type) {
      case 'static':
        lines.push(`const ${refName} = ref(${quote(source.config.staticData ?? null)})`)
        break

      case 'rest': {
        const method = (source.config.method ?? 'GET').toUpperCase()
        const url = `${source.config.url ?? ''}${buildQuery(source.config.params)}`
        const hasBody = method !== 'GET' && method !== 'HEAD' && source.config.params
        lines.push(`const ${refName} = ref(null)`)
        lines.push(`async function ${dataSourceLoadName(source.id)}() {`)
        lines.push('  try {')
        lines.push(`    const res = await fetch(${quote(url)}, {`)
        lines.push(`      method: ${quote(method)},`)
        lines.push(`      headers: ${quote(source.config.headers ?? {})},`)
        if (hasBody) lines.push(`      body: JSON.stringify(${quote(source.config.params)}),`)
        lines.push('    })')
        lines.push(`    ${refName}.value = await res.json()`)
        lines.push('  } catch (error) {')
        lines.push(`    console.warn('[codegen] 数据源 ${source.id} 加载失败', error)`)
        lines.push('  }')
        lines.push('}')
        const loadName = dataSourceLoadName(source.id)
        if (source.autoLoad !== false) mountCalls.push(`  ${loadName}()`)
        if (source.config.pollInterval) {
          const timer = `timer_${refName}`
          lines.push(`const ${timer} = setInterval(${loadName}, ${source.config.pollInterval})`)
          cleanupLines.push(`  clearInterval(${timer})`)
        }
        break
      }

      case 'localStorage':
      case 'sessionStorage': {
        const storage = source.type === 'localStorage' ? 'localStorage' : 'sessionStorage'
        const key = quote(source.config.storageKey ?? '')
        lines.push(`const ${refName} = ref((() => {`)
        lines.push('  try {')
        lines.push(`    return JSON.parse(${storage}.getItem(${key}) || 'null')`)
        lines.push('  } catch {')
        lines.push('    return null')
        lines.push('  }')
        lines.push('})())')
        break
      }

      case 'pageVariable': {
        const variableId = source.config.variableId ?? source.id
        const target = variableRefs.get(variableId)
        lines.push(target ? `const ${refName} = ${target}` : `const ${refName} = ref(null)`)
        if (!target) {
          warnings.push({
            code: 'datasource-deferred',
            message: `数据源 ${source.id} 引用的页面变量 ${variableId} 不存在`,
          })
        }
        break
      }

      default:
        lines.push(`const ${refName} = ref(null)`)
        warnings.push({
          code: 'datasource-deferred',
          message: `数据源 ${source.id}（${source.type}）将在 P2 后续生成`,
        })
    }
  }

  return { lines, mountCalls, cleanupLines, warnings }
}
