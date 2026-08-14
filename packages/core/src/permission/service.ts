import {
  FIELD_PERMISSION_ACTIONS,
  TABLE_PERMISSION_ACTIONS,
  type CrudAction,
  type DataModelPermissions,
} from '@lowcode/schema'
import type { UserContext } from './types'

export type TablePermissionAction = (typeof TABLE_PERMISSION_ACTIONS)[number]
export type FieldPermissionAction = (typeof FIELD_PERMISSION_ACTIONS)[number]

/**
 * 表级权限：取用户各角色命中的最宽松动作（full > readonly > none）。
 * 无匹配默认 none（拒绝优先）。
 */
export function evaluateTableAccess(
  permissions: DataModelPermissions | undefined,
  roles: string[],
): TablePermissionAction {
  const matched = (permissions?.table ?? []).filter((p) => roles.includes(p.role))
  if (matched.some((p) => p.action === 'full')) return 'full'
  if (matched.some((p) => p.action === 'readonly')) return 'readonly'
  if (matched.some((p) => p.action === 'none')) return 'none'
  return 'none'
}

/** 操作级权限：允许的动作 = 各角色命中的动作并集 */
export function evaluateOperations(
  permissions: DataModelPermissions | undefined,
  roles: string[],
): Set<CrudAction> {
  const result = new Set<CrudAction>()
  for (const p of permissions?.operation ?? []) {
    if (roles.includes(p.role)) {
      for (const action of p.actions) result.add(action)
    }
  }
  return result
}

/** 是否允许对资源执行指定操作（create/read/update/delete） */
export function canOperation(
  permissions: DataModelPermissions | undefined,
  roles: string[],
  action: CrudAction,
): boolean {
  return evaluateOperations(permissions, roles).has(action)
}

/**
 * 字段级权限：取命中的最宽松动作（editable > readonly > hidden）。
 * 无匹配默认 editable（表级已做整体门控，字段级仅进一步收窄）。
 */
export function evaluateFieldAccess(
  permissions: DataModelPermissions | undefined,
  roles: string[],
  fieldName: string,
): FieldPermissionAction {
  const matched = (permissions?.field ?? []).filter(
    (p) => p.fieldName === fieldName && roles.includes(p.role),
  )
  if (matched.some((p) => p.action === 'editable')) return 'editable'
  if (matched.some((p) => p.action === 'readonly')) return 'readonly'
  if (matched.some((p) => p.action === 'hidden')) return 'hidden'
  return 'editable'
}

/**
 * 权限服务：消费用户角色 + 资源权限声明（DataModelPermissions），
 * 输出 can / tableAccess / fieldAccess，供路由守卫、菜单过滤、按钮/字段控制使用。
 * 纯 TS，不依赖 UI 框架。
 */
export class PermissionService {
  private permissions = new Map<string, DataModelPermissions>()

  constructor(readonly user: UserContext) {}

  hasRole(role: string): boolean {
    return this.user.roles.includes(role)
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((role) => this.hasRole(role))
  }

  /** 注册某个资源（DataModel/页面/菜单）的权限声明 */
  setPermissions(resource: string, permissions: DataModelPermissions): void {
    this.permissions.set(resource, permissions)
  }

  /** 操作级：能否对资源执行 action（如页面/菜单的 read，按钮的 update） */
  can(resource: string, action: CrudAction): boolean {
    return canOperation(this.permissions.get(resource), this.user.roles, action)
  }

  /** 表级：资源整体访问级别 */
  tableAccess(resource: string): TablePermissionAction {
    return evaluateTableAccess(this.permissions.get(resource), this.user.roles)
  }

  /** 字段级：某字段的可编辑性 */
  fieldAccess(resource: string, fieldName: string): FieldPermissionAction {
    return evaluateFieldAccess(this.permissions.get(resource), this.user.roles, fieldName)
  }
}
