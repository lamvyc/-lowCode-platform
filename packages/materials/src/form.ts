import type { Component } from 'vue'
import type { IFormWidgetResolver } from '@lowcode/runtime'
import LcInput from './components/Input.vue'
import LcSelect from './components/Select.vue'

/** 已覆盖的 widget 名 → Element Plus 物料组件 */
const WIDGETS: Record<string, Component> = {
  input: LcInput,
  select: LcSelect,
}

/**
 * 表单控件解析器：widget 名 → Element Plus 物料。
 * 未覆盖的 widget（textarea/switch/input-number/date-picker）返回 undefined，
 * 由 FormRenderer 回退到 runtime 内置的纯 render 控件。
 */
export function createFormWidgetResolver(): IFormWidgetResolver {
  return {
    resolve: (widget) => WIDGETS[widget],
    has: (widget) => widget in WIDGETS,
  }
}
