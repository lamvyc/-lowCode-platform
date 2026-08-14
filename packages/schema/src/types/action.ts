import type { LegacyEventAction } from './event'

/** 标准 Action 类型枚举（P1 声明式优先） */
export const STANDARD_ACTION_TYPES = [
  'navigate', // 页面跳转
  'submit', // 表单提交
  'openDialog', // 打开弹窗
  'closeDialog', // 关闭弹窗
  'invokeAPI', // 调用 API
  'dispatchEvent', // 触发自定义事件
  'setState', // 更新组件/页面状态
  'refresh', // 刷新数据源
] as const

export type ActionType = (typeof STANDARD_ACTION_TYPES)[number]

/**
 * 动作 type 的可接受值：标准枚举 + 插件自定义字符串。
 * `string & {}` 保留标准枚举成员的 IDE 自动补全，同时放行任意自定义动作类型，
 * 使插件注册的动作也能在统一 Schema 中表达（由 ActionRegistry 按 type 查找实现）。
 */
export type UnifiedActionType = ActionType | (string & {})

/** 类型守卫：是否为平台标准动作（用于区分内置与插件自定义动作） */
export function isStandardActionType(type: string): type is ActionType {
  return (STANDARD_ACTION_TYPES as readonly string[]).includes(type)
}

/**
 * 统一事件动作：type + target + params（P1）
 * 交互行为由引擎按 type 解释执行，不在 Schema 中嵌入命令式逻辑。
 */
export interface UnifiedEventAction {
  id: string
  type: UnifiedActionType
  label?: string
  /** 动作目标：节点 id / 数据源 id / 弹窗 id / 路由 */
  target?: string
  /** 动作参数，由引擎按 type 解释 */
  params?: Record<string, unknown>
  /** 可选执行条件（沙箱表达式，P3） */
  expression?: string
}

/** 旧版 ActionKind → 标准 ActionType 映射（P5 废弃迁移）；custom 由 actionId 直接映射为自定义 type */
export const LEGACY_ACTION_TYPE_MAP: Record<
  Exclude<LegacyEventAction['kind'], 'custom'>,
  ActionType
> = {
  setProp: 'setState',
  setVariable: 'setState',
  openDialog: 'openDialog',
  closeDialog: 'closeDialog',
  emitEvent: 'dispatchEvent',
  request: 'invokeAPI',
  navigate: 'navigate',
}

/** 旧版事件动作 → 统一事件动作（用于 1.x → 2.x 迁移） */
export function normalizeEventAction(action: LegacyEventAction): UnifiedEventAction {
  // 旧版 custom 动作：config.actionId 即自定义动作类型，直接作为统一 type（不再降级为 dispatchEvent）
  if (action.kind === 'custom') {
    return {
      id: action.id,
      type: String(action.config.actionId ?? 'custom'),
      label: action.label,
      params: action.config,
      expression: action.when,
    }
  }
  return {
    id: action.id,
    type: LEGACY_ACTION_TYPE_MAP[action.kind],
    label: action.label,
    params: action.config,
    expression: action.when,
  }
}

/**
 * 统一事件动作 → 旧版事件动作（运行时兼容视图，P5）
 * 说明：submit / refresh 在旧版引擎没有一等动作，映射为 custom 注册键，
 * 语义完整实现应由统一 Action 引擎提供。
 */
export function unifiedEventToLegacy(action: UnifiedEventAction): LegacyEventAction {
  const params = action.params ?? {}
  const base = { id: action.id, label: action.label, when: action.expression }
  switch (action.type) {
    case 'navigate':
      return {
        ...base,
        kind: 'navigate',
        config: { route: params.route ?? params.path ?? action.target ?? '' },
      }
    case 'openDialog':
      return {
        ...base,
        kind: 'openDialog',
        config: { dialogId: params.dialogId ?? action.target ?? '', payload: params.payload },
      }
    case 'closeDialog':
      return {
        ...base,
        kind: 'closeDialog',
        config: { dialogId: params.dialogId ?? action.target ?? '' },
      }
    case 'dispatchEvent':
      return {
        ...base,
        kind: 'emitEvent',
        config: {
          event: params.event ?? params.eventName ?? action.target ?? '',
          payload: params.payload,
        },
      }
    case 'invokeAPI':
      return {
        ...base,
        kind: 'request',
        config: {
          dataSourceId: params.dataSourceId ?? action.target,
          url: params.url,
          method: params.method,
          params: params.params,
          headers: params.headers,
        },
      }
    case 'setState':
      if (params.nodeId !== undefined && params.prop !== undefined) {
        return {
          ...base,
          kind: 'setProp',
          config: {
            nodeId: params.nodeId,
            prop: params.prop,
            value: params.value,
            expression: params.expression,
          },
        }
      }
      return {
        ...base,
        kind: 'setVariable',
        config: {
          name: params.name ?? action.target ?? 'state',
          value: params.value,
          expression: params.expression,
        },
      }
    case 'submit':
      return { ...base, kind: 'custom', config: { ...params, actionId: 'submit' } }
    case 'refresh':
      return {
        ...base,
        kind: 'custom',
        config: {
          ...params,
          actionId: 'refresh',
          dataSourceId: params.dataSourceId ?? action.target,
        },
      }
    default:
      // 插件自定义动作：映射为旧版 custom，由 ActionRegistry 按 actionId（= type）查找实现
      return {
        ...base,
        kind: 'custom',
        config: { ...params, actionId: action.type },
      }
  }
}
