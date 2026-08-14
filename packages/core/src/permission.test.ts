import { describe, expect, it } from 'vitest'
import type { DataModelPermissions } from '@lowcode/schema'
import {
  PermissionService,
  canOperation,
  evaluateFieldAccess,
  evaluateOperations,
  evaluateTableAccess,
} from '@lowcode/core'

const perms: DataModelPermissions = {
  table: [
    { role: 'admin', action: 'full' },
    { role: 'sales', action: 'readonly' },
    { role: 'guest', action: 'none' },
  ],
  operation: [
    { role: 'admin', actions: ['create', 'read', 'update', 'delete'] },
    { role: 'sales', actions: ['read'] },
  ],
  field: [
    { fieldName: 'amount', role: 'sales', action: 'readonly' },
    { fieldName: 'secret', role: 'sales', action: 'hidden' },
    { fieldName: 'amount', role: 'admin', action: 'editable' },
  ],
}

describe('三级权限纯函数', () => {
  it('表级取最宽松，多角色并集', () => {
    expect(evaluateTableAccess(perms, ['admin'])).toBe('full')
    expect(evaluateTableAccess(perms, ['sales'])).toBe('readonly')
    expect(evaluateTableAccess(perms, ['guest'])).toBe('none')
    expect(evaluateTableAccess(perms, ['sales', 'guest'])).toBe('readonly')
    expect(evaluateTableAccess(perms, ['admin', 'guest'])).toBe('full')
  })

  it('表级无匹配默认 none（拒绝）', () => {
    expect(evaluateTableAccess(perms, ['stranger'])).toBe('none')
    expect(evaluateTableAccess(undefined, ['admin'])).toBe('none')
  })

  it('操作级取各角色并集', () => {
    expect(canOperation(perms, ['sales'], 'read')).toBe(true)
    expect(canOperation(perms, ['sales'], 'update')).toBe(false)
    expect(canOperation(perms, ['admin'], 'delete')).toBe(true)
    expect(evaluateOperations(perms, ['sales'])).toEqual(new Set(['read']))
  })

  it('字段级 editable > readonly > hidden，默认 editable', () => {
    expect(evaluateFieldAccess(perms, ['admin'], 'amount')).toBe('editable')
    expect(evaluateFieldAccess(perms, ['sales'], 'amount')).toBe('readonly')
    expect(evaluateFieldAccess(perms, ['sales'], 'secret')).toBe('hidden')
    expect(evaluateFieldAccess(perms, ['sales'], 'other')).toBe('editable')
  })
})

describe('PermissionService', () => {
  it('注册资源权限并按角色判定', () => {
    const service = new PermissionService({ id: 'u1', roles: ['sales'] })
    service.setPermissions('Order', {
      table: [{ role: 'sales', action: 'readonly' }],
      operation: [{ role: 'sales', actions: ['read'] }],
      field: [{ fieldName: 'amount', role: 'sales', action: 'readonly' }],
    })
    expect(service.hasRole('sales')).toBe(true)
    expect(service.can('Order', 'read')).toBe(true)
    expect(service.can('Order', 'update')).toBe(false)
    expect(service.tableAccess('Order')).toBe('readonly')
    expect(service.fieldAccess('Order', 'amount')).toBe('readonly')
    expect(service.fieldAccess('Order', 'other')).toBe('editable')
  })

  it('未注册资源默认拒绝', () => {
    const service = new PermissionService({ id: 'u1', roles: ['admin'] })
    expect(service.can('Missing', 'read')).toBe(false)
    expect(service.tableAccess('Missing')).toBe('none')
  })
})
