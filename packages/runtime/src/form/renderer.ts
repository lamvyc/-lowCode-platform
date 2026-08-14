import { defineComponent, h, onBeforeUnmount, ref, type PropType, type VNode } from 'vue'
import type { FormEngine, FormField } from '@lowcode/core'
import { defaultFormWidgetResolver, type IFormWidgetResolver, type WidgetOption } from './widget'

/** 把原始枚举/选项值归一化为 { label, value } 结构 */
function normalizeOptions(options?: unknown[]): WidgetOption[] {
  if (!options) return []
  return options.map((option) => {
    if (option && typeof option === 'object' && 'label' in option && 'value' in option) {
      return option as WidgetOption
    }
    return { label: String(option), value: option }
  })
}

function renderField(engine: FormEngine, resolver: IFormWidgetResolver, field: FormField): VNode {
  const widgetType = field.widget ?? 'input'
  const widget = resolver.resolve(widgetType) ?? defaultFormWidgetResolver.resolve(widgetType)
  const label = field.label ?? field.name
  const error = engine.getError(field.name)

  const control = widget
    ? h(widget, {
        modelValue: engine.getValue(field.name),
        disabled: engine.isFieldDisabled(field.name),
        options: normalizeOptions(field.options),
        'onUpdate:modelValue': (value: unknown) => engine.setValue(field.name, value),
        onBlur: () => engine.touch(field.name),
      })
    : h('div', { class: 'lc-form-widget-missing' }, `[未注册控件: ${widgetType}]`)

  return h('div', { class: 'lc-form-field', 'data-field': field.name }, [
    h('label', { class: 'lc-form-field__label' }, label),
    control,
    error ? h('div', { class: 'lc-form-field__error' }, error) : null,
  ])
}

/**
 * 表单渲染器：消费 FormEngine，按字段渲染 label + 控件 + 错误。
 * FormEngine 非响应式，通过订阅 onChange 触发重渲染。
 */
export const FormRenderer = defineComponent({
  name: 'FormRenderer',
  props: {
    engine: { type: Object as PropType<FormEngine>, required: true },
    resolver: {
      type: Object as PropType<IFormWidgetResolver>,
      default: () => defaultFormWidgetResolver,
    },
  },
  setup(props) {
    const version = ref(0)
    const off = props.engine.onChange(() => {
      version.value += 1
    })
    onBeforeUnmount(off)

    return () => {
      // 读取 version 建立响应式依赖，engine 状态变化时驱动重渲染
      void version.value
      const fields = props.engine.schema.fields.filter((f) => props.engine.isFieldVisible(f.name))
      return h('div', { class: 'lc-form' }, fields.map((f) => renderField(props.engine, props.resolver, f)))
    }
  },
})
