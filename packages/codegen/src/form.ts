import { getFormSettings, type PageNode, type PageSchema } from '@lowcode/schema'
import type { MappingRegistry } from './mappings/types'
import type { MappingContext } from './mappings/types'
import { sanitizeIdentifier, type CodegenPlan } from './plan'
import type { ResolvedForm } from './types'

/** 解析表单设置并把三个名字转成合法标识符 */
export function resolveForm(schema: PageSchema): ResolvedForm {
  const settings = getFormSettings(schema.settings)
  return {
    modelName: sanitizeIdentifier(settings.modelName ?? 'formData', 'formData'),
    refName: sanitizeIdentifier(settings.refName ?? 'formRef', 'formRef'),
    rulesName: sanitizeIdentifier(settings.rulesName ?? 'formRules', 'formRules'),
    labelPosition: settings.labelPosition ?? 'left',
    labelAlign: settings.labelAlign ?? 'left',
    labelWidth: settings.labelWidth ?? 80,
    size: settings.size ?? 'default',
    customClass: settings.customClass ?? [],
    cssCode: settings.cssCode ?? '',
    functions: settings.functions ?? '',
  }
}

function serializeValue(value: unknown): string {
  if (value === undefined) return 'null'
  return JSON.stringify(value)
}

/**
 * 生成 formData 的对象字面量（不含 `const ... = reactive(...)` 外壳）。
 * 只遍历字段节点；显式 modelValue 优先，缺失时走 mapping.initialValue。
 */
export function buildFormData(plan: CodegenPlan, registry: MappingRegistry): string {
  if (plan.fieldNodes.length === 0) return '{}'
  const entries = plan.fieldNodes.map((node) => {
    const key = plan.modelKeys.get(node.id) ?? sanitizeIdentifier(node.id, node.id)
    const initial = 'modelValue' in node.props
      ? node.props.modelValue
      : registry.get(node.type)?.initialValue?.(node) ?? null
    return `  ${key}: ${serializeValue(initial)},`
  })
  return `{\n${entries.join('\n')}\n}`
}

/** el-form 的属性：ref / model / rules / 排版设置 */
export function buildFormAttrs(form: ResolvedForm, hasFields: boolean): Record<string, string> {
  if (!hasFields) return {}
  const classes = ['lc-page', ...form.customClass].join(' ')
  return {
    ref: form.refName,
    ':model': form.modelName,
    ':rules': form.rulesName,
    'label-position': form.labelPosition,
    'label-width': `${form.labelWidth}px`,
    size: form.size,
    class: classes,
  }
}

/** el-form-item 的属性：label / prop / label-width / 对齐类 */
export function buildFormItemAttrs(
  node: PageNode,
  ctx: MappingContext,
): Record<string, string> {
  const attrs: Record<string, string> = {
    prop: ctx.modelKey(node),
  }
  const hidden = node.props.labelHidden === true
  const label = typeof node.props.label === 'string' ? node.props.label : ''
  if (!hidden && label !== '') attrs.label = label
  if (hidden) {
    attrs['label-width'] = '0'
  } else if (typeof node.props.labelWidth === 'number') {
    attrs['label-width'] = `${node.props.labelWidth}px`
  }
  const align = node.props.labelAlign
  if ((align === 'left' || align === 'center' || align === 'right') && align !== ctx.form.labelAlign) {
    attrs.class = `lc-label-${align}`
  }
  return attrs
}
