import type { InjectionKey } from 'vue'
import type { PageNode } from '@lowcode/schema'
import type { RuntimeContext } from './context'

/**
 * 字段节点上下文：渲染器为每个字段节点 provide 一份，物料组件（含 FormItem 外壳）
 * 通过它得知"我是哪个节点"，从而读取字段值、校验错误等。
 *
 * 为什么需要它：物料只从 props 拿数据，而 `node.id` / `node.name` 是**节点级**信息
 * （不在 `node.props` 里）。若改用 prop 传递，28 个物料都得各加两个 prop；
 * 用 provide/inject 则一次接线、全部生效，且不改变 DOM 结构。
 */
export const FIELD_CONTEXT_KEY: InjectionKey<FieldContext> = Symbol('lc.fieldContext')

export interface FieldContext {
  /** 节点 id（稳定，重命名不变） */
  readonly nodeId: string
  /** 字段名（节点 name，缺省回退到 id） */
  readonly fieldName: string
}

/** optionItems 中的一项（与物料约定一致：{ label, value, disabled }） */
interface OptionItem {
  label?: unknown
  value?: unknown
  disabled?: boolean
}

/** 把 class 属性归一化为字符串数组（可能是数组 / 空格分隔字符串 / undefined）。 */
function toClassList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) return raw.trim().split(/\s+/)
  return []
}

function toOptionItems(raw: unknown): OptionItem[] {
  return Array.isArray(raw) ? (raw as OptionItem[]) : []
}

/**
 * 浅拷贝选项数组（数组与每个选项对象各拷一层）。
 *
 * 参考实现用 `deepClone`；选项是扁平的 `{ label, value, disabled }`，浅拷一层足够，
 * 同时避免把 schema 里的原数组直接暴露给调用方改写。
 */
function cloneOptionItems(options: unknown[]): unknown[] {
  return options.map((item) =>
    item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item,
  )
}

/**
 * 字段句柄：把一个字段节点的读写能力封装成**与参考实现同名**的 API。
 *
 * 对应参考实现的 `fieldMixin` 公开方法（variant-form `fieldMixin.js:405-610`），
 * 但落在 Schema 架构上的通道不同：
 *
 * | 参考实现 | 本架构通道 |
 * | --- | --- |
 * | `setValue` / `getValue` / `resetField` | 运行时值存储（`RuntimeContext.setNodeValue`），**不写 schema** |
 * | `setDisabled` / `setReadonly` / `setRequired` / `setLabel` / `setOption` / `loadOptions` … | 属性写入（`setNodeProp`）：编辑器走 schema 历史，预览走本地 override |
 * | `setHidden` | **节点级**系统属性（`meta.hidden`），故走 `setNodeHidden` |
 *
 * 未提供的参考 API 见本文件末尾说明。
 */
export interface FieldHandle {
  /** 节点 id（稳定，重命名不变） */
  readonly nodeId: string
  /** 字段名（节点 `name`，缺省回退到 id） */
  readonly name: string

  // ---- 取值 / 赋值 / 重置 ----
  getValue(): unknown
  setValue(value: unknown): void
  /** 恢复为 schema 中的默认值（清空值覆盖，对应参考实现的 `resetField`） */
  resetField(): void

  // ---- 选项 ----
  getOptions(): unknown[]
  /** 加载选项（参考实现里与 `reloadOptions` 行为完全相同，见下） */
  loadOptions(options: unknown[]): void
  reloadOptions(options: unknown[]): void
  disableOption(optionValue: unknown): void
  enableOption(optionValue: unknown): void

  // ---- 状态开关 ----
  setDisabled(flag: boolean): void
  setReadonly(flag: boolean): void
  /** 隐藏是**节点级**属性，不是组件 prop */
  setHidden(flag: boolean): void
  setRequired(flag: boolean): void
  setLabel(label: string): void

  // ---- 通用 / 样式 ----
  /** 通用选项修改（对应参考实现的 `setWidgetOption`） */
  setOption(optionName: string, optionValue: unknown): void
  addClass(className: string): void
  removeClass(className: string): void
}

/** 为某个节点创建字段句柄 */
export function createFieldHandle(ctx: RuntimeContext, nodeId: string): FieldHandle {
  const node = (): PageNode | undefined => ctx.getNode(nodeId)

  /** 按 value 匹配并改写 optionItems 中对应项的 disabled */
  function setOptionDisabled(optionValue: unknown, disabled: boolean): void {
    const current = node()
    if (!current) return
    const items = toOptionItems(ctx.resolveProp(current, 'optionItems'))
    let changed = false
    const next = items.map((item) => {
      if (item.value === optionValue && item.disabled !== disabled) {
        changed = true
        return { ...item, disabled }
      }
      return item
    })
    if (changed) ctx.setNodeProp(nodeId, 'optionItems', next)
  }

  return {
    nodeId,
    get name(): string {
      return node()?.name ?? nodeId
    },

    getValue: () => ctx.getNodeValue(nodeId),
    setValue: (value) => {
      ctx.setNodeValue(nodeId, value)
    },
    resetField: () => {
      ctx.resetNodeValue(nodeId)
    },

    getOptions: () => {
      const current = node()
      return current ? toOptionItems(ctx.resolveProp(current, 'optionItems')) : []
    },
    // 参考实现里两者的实现完全相同（`loadOptions` 里"清空已选值"那行被注释掉了），
    // 故此处同样一致，只是保留两个名字以对齐调用方习惯。见 00-通用字段行为规范.md 6.2。
    loadOptions: (options) => {
      ctx.setNodeProp(nodeId, 'optionItems', cloneOptionItems(options))
    },
    reloadOptions: (options) => {
      ctx.setNodeProp(nodeId, 'optionItems', cloneOptionItems(options))
    },
    disableOption: (optionValue) => {
      setOptionDisabled(optionValue, true)
    },
    enableOption: (optionValue) => {
      setOptionDisabled(optionValue, false)
    },

    setDisabled: (flag) => {
      ctx.setNodeProp(nodeId, 'disabled', flag)
    },
    setReadonly: (flag) => {
      ctx.setNodeProp(nodeId, 'readonly', flag)
    },
    setHidden: (flag) => {
      ctx.setNodeHidden(nodeId, flag)
    },
    setRequired: (flag) => {
      ctx.setNodeProp(nodeId, 'required', flag)
    },
    setLabel: (label) => {
      ctx.setNodeProp(nodeId, 'label', label)
    },

    setOption: (optionName, optionValue) => {
      ctx.setNodeProp(nodeId, optionName, optionValue)
    },
    addClass: (className) => {
      const current = node()
      if (!current) return
      const list = toClassList(ctx.resolveProp(current, 'class'))
      if (list.includes(className)) return
      ctx.setNodeProp(nodeId, 'class', [...list, className])
    },
    removeClass: (className) => {
      const current = node()
      if (!current) return
      const list = toClassList(ctx.resolveProp(current, 'class'))
      if (!list.includes(className)) return
      ctx.setNodeProp(
        nodeId,
        'class',
        list.filter((item) => item !== className),
      )
    },
  }
}

/**
 * 有意**未提供**的参考 API，以及原因：
 *
 * - `focus()` / `getFieldEditor()` —— 需要持有组件实例（参考实现的 `$refs['fieldEditor']`）。
 *   本架构目前没有实例注册表；组件失焦/聚焦应由组件自身能力或动作链表达。
 *   若确需，可再加一层 `ref` 回调注册表，但会引入实例生命周期管理成本。
 * - `setUploadHeader` / `setUploadData` / `setToolbar` —— 写的是组件**内部** data，
 *   参考实现靠 mixin 直接改 `this.uploadHeaders`。本架构下这属于组件自身状态，
 *   不属于节点配置，需先决定是否上提到 schema。
 * - `isSubFormItem()` —— 取决于子表单容器是否落地（当前物料清单里没有 sub-form）。
 */
