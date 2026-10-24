import type { PageSchema } from '@lowcode/schema'
import { rewriteExpression } from './expressions'
import { sanitizeIdentifier } from './plan'

export interface ActionRuntimeOptions {
  modelName: string
  variableNames: string[]
  datasourceIds: string[]
  dataSources: Array<{ id: string; loadName: string }>
}

function pascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** 事件处理器名：onClick_b1 */
export function actionHandlerName(nodeId: string, eventName: string): string {
  return `on${pascalCase(eventName)}_${sanitizeIdentifier(nodeId, 'node')}`
}

/** 生成动作运行期状态 + runAction + 按节点事件处理器 */
export function buildActionRuntime(schema: PageSchema, options: ActionRuntimeOptions): string[] {
  const lines: string[] = []
  lines.push('const overrides = reactive({})')
  lines.push('const dialogs = reactive({})')
  lines.push('const requestResult = ref(null)')
  lines.push('')
  lines.push('function setNodeProp(nodeId, prop, value) {')
  lines.push('  overrides[nodeId] ??= {}')
  lines.push('  overrides[nodeId][prop] = value')
  lines.push('}')
  lines.push('')
  lines.push('function runAction(action, payload, nodeId) {')
  lines.push('  try {')
  lines.push('    switch (action.kind) {')
  lines.push("      case 'setProp':")
  lines.push(
    '        setNodeProp(action.config.nodeId || nodeId, String(action.config.prop ?? ""), action.config.value)',
  )
  lines.push('        break')
  lines.push("      case 'setVariable': {")
  lines.push('        const name = String(action.config.name ?? "")')
  lines.push('        switch (name) {')
  for (const variable of schema.variables) {
    const name = sanitizeIdentifier(variable.name, 'variable')
    lines.push(`          case ${JSON.stringify(variable.name)}:`)
    lines.push(`            ${name}.value = action.config.value`)
    lines.push('            break')
  }
  lines.push('          default:')
  lines.push("            console.warn('[codegen] 未找到页面变量', name)")
  lines.push('        }')
  lines.push('        break')
  lines.push('      }')
  lines.push("      case 'openDialog':")
  lines.push('        dialogs[String(action.config.dialogId ?? "")] = true')
  lines.push('        break')
  lines.push("      case 'closeDialog':")
  lines.push('        dialogs[String(action.config.dialogId ?? "")] = false')
  lines.push('        break')
  lines.push("      case 'emitEvent':")
  lines.push(
    "        window.dispatchEvent(new CustomEvent(String(action.config.event ?? ''), { detail: payload }))",
  )
  lines.push('        break')
  lines.push("      case 'request': {")
  lines.push('        const url = String(action.config.url ?? "")')
  lines.push('        if (url) {')
  lines.push('          fetch(url, {')
  lines.push('            method: action.config.method || "GET",')
  lines.push('            headers: action.config.headers || undefined,')
  lines.push('            body: action.config.data ? JSON.stringify(action.config.data) : undefined,')
  lines.push('          })')
  lines.push('            .then((res) => res.json())')
  lines.push('            .then((data) => { requestResult.value = data })')
  lines.push("            .catch((error) => console.warn('[codegen] request 失败', error))")
  lines.push('        }')
  lines.push('        break')
  lines.push('      }')
  lines.push("      case 'navigate': {")
  lines.push('        const route = String(action.config.route ?? "")')
  lines.push('        if (route.startsWith("#")) location.hash = route')
  lines.push('        else location.href = route')
  lines.push('        break')
  lines.push('      }')
  lines.push("      case 'submit': {")
  lines.push('        if (!formRef.value) {')
  lines.push("          console.warn('[codegen] 页面没有可提交的表单')")
  lines.push('          break')
  lines.push('        }')
  lines.push('        formRef.value')
  lines.push('          .validate()')
  lines.push('          .then((valid) => {')
  lines.push('            if (!valid) return')
  lines.push('            window.dispatchEvent(')
  lines.push("              new CustomEvent('lc-submit', {")
  lines.push('                detail: JSON.parse(JSON.stringify(formData)),')
  lines.push('              }),')
  lines.push('            )')
  lines.push('          })')
  lines.push("          .catch(() => {})")
  lines.push('        break')
  lines.push('      }')
  lines.push("      case 'refresh': {")
  lines.push('        const dataSourceId = String(action.config.dataSourceId ?? "")')
  lines.push('        switch (dataSourceId) {')
  for (const source of options.dataSources) {
    lines.push(`          case ${JSON.stringify(source.id)}:`)
    lines.push(`            ${source.loadName}()`)
    lines.push('            break')
  }
  lines.push('          default:')
  lines.push("            console.warn('[codegen] 未找到数据源', dataSourceId)")
  lines.push('        }')
  lines.push('        break')
  lines.push('      }')
  lines.push('      default:')
  lines.push("        console.warn('[codegen] 未支持的动作类型', action.kind)")
  lines.push('    }')
  lines.push('  } catch (error) {')
  lines.push("    console.warn('[codegen] 动作执行失败', error)")
  lines.push('  }')
  lines.push('}')
  lines.push('')

  for (const node of schema.nodes) {
    for (const [eventName, actions] of Object.entries(node.events ?? {})) {
      const handler = actionHandlerName(node.id, eventName)
      lines.push(`function ${handler}(payload) {`)
      lines.push(`  const actions = ${JSON.stringify(actions, null, 2)}`)
      lines.push('  for (const action of actions) {')
      for (const action of actions) {
        if (action.when) {
          const expression = rewriteExpression(
            action.when,
            options.datasourceIds,
            options.variableNames,
            'script',
          )
          lines.push(`    if (action.when) {`)
          lines.push(`      if (!(${expression})) continue`)
          lines.push('    }')
        }
        lines.push(`    runAction(${JSON.stringify(action)}, payload, ${JSON.stringify(node.id)})`)
      }
      lines.push('  }')
      lines.push('}')
      lines.push('')
    }
  }
  return lines
}
