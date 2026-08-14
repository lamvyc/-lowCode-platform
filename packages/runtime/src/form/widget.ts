import { defineComponent, h, type Component, type PropType } from 'vue'

/** 表单控件解析器：把 widget 名（input/select/switch/…）映射为 Vue 组件 */
export interface IFormWidgetResolver {
  resolve(widget: string): Component | undefined
  has?(widget: string): boolean
}

/** 下拉选项（渲染前已由 FormRenderer 归一化） */
export interface WidgetOption {
  label: string
  value: unknown
}

function stringify(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

/** 文本类控件工厂（input / input-number / date-picker） */
function makeTextWidget(
  name: string,
  type: string,
  coerce?: (raw: string) => unknown,
): Component {
  return defineComponent({
    name,
    props: {
      modelValue: { type: [String, Number, Boolean] as PropType<unknown>, default: undefined },
      disabled: { type: Boolean, default: false },
      placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue', 'blur'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          type,
          value: stringify(props.modelValue),
          disabled: props.disabled,
          placeholder: props.placeholder,
          onInput: (event: Event) => {
            const raw = (event.target as HTMLInputElement).value
            emit('update:modelValue', coerce ? coerce(raw) : raw)
          },
          onBlur: () => emit('blur'),
        })
    },
  })
}

export const LcFormInput = makeTextWidget('LcFormInput', 'text')
export const LcFormNumber = makeTextWidget('LcFormNumber', 'number', (raw) =>
  raw === '' ? undefined : Number(raw),
)
export const LcFormDate = makeTextWidget('LcFormDate', 'date')

export const LcFormTextarea = defineComponent({
  name: 'LcFormTextarea',
  props: {
    modelValue: { type: String as PropType<string>, default: '' },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        value: stringify(props.modelValue),
        disabled: props.disabled,
        placeholder: props.placeholder,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
        onBlur: () => emit('blur'),
      })
  },
})

export const LcFormSelect = defineComponent({
  name: 'LcFormSelect',
  props: {
    modelValue: { type: [String, Number, Boolean] as PropType<unknown>, default: undefined },
    disabled: { type: Boolean, default: false },
    options: { type: Array as PropType<WidgetOption[]>, default: () => [] },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          value: stringify(props.modelValue),
          disabled: props.disabled,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
          onBlur: () => emit('blur'),
        },
        props.options.map((option) =>
          h('option', { value: stringify(option.value) }, option.label),
        ),
      )
  },
})

export const LcFormSwitch = defineComponent({
  name: 'LcFormSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        type: 'checkbox',
        checked: Boolean(props.modelValue),
        disabled: props.disabled,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
        onBlur: () => emit('blur'),
      })
  },
})

const BUILTIN_WIDGETS: Record<string, Component> = {
  input: LcFormInput,
  textarea: LcFormTextarea,
  select: LcFormSelect,
  switch: LcFormSwitch,
  'input-number': LcFormNumber,
  'date-picker': LcFormDate,
}

/** 默认表单控件解析器（纯 render 函数，无第三方 UI 依赖） */
export const defaultFormWidgetResolver: IFormWidgetResolver = {
  resolve: (widget) => BUILTIN_WIDGETS[widget],
  has: (widget) => widget in BUILTIN_WIDGETS,
}
