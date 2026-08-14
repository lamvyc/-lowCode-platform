import { describe, expect, it, vi } from 'vitest'
import { PermissionService } from '@lowcode/core'
import {
  createPermissionDirective,
  hasPermission,
  type PermissionBindingValue,
} from '@lowcode/runtime'

function makeService(): PermissionService {
  const service = new PermissionService({ id: 'u1', roles: ['sales'] })
  service.setPermissions('Order', {
    operation: [{ role: 'sales', actions: ['read'] }],
  })
  return service
}

/** 直接调用指令 mounted 钩子（绕开 Vue 渲染，验证移除逻辑） */
function mounted(
  directive: ReturnType<typeof createPermissionDirective>,
  el: HTMLElement,
  value: PermissionBindingValue,
): void {
  const hook = directive.mounted as unknown as (
    el: unknown,
    binding: { value: unknown },
    vnode: unknown,
    prev: unknown,
  ) => void
  hook(el, { value }, null, null)
}

describe('hasPermission 纯判定', () => {
  it('有权限返回 true，无权限返回 false', () => {
    const service = makeService()
    expect(hasPermission(service, { resource: 'Order', action: 'read' })).toBe(true)
    expect(hasPermission(service, { resource: 'Order', action: 'update' })).toBe(false)
  })

  it('无绑定值视为放行', () => {
    expect(hasPermission(makeService(), undefined)).toBe(true)
  })
})

describe('v-permission 指令', () => {
  it('无权限时移除元素', () => {
    const directive = createPermissionDirective(makeService())
    const removeChild = vi.fn()
    const el = { parentNode: { removeChild } } as unknown as HTMLElement
    mounted(directive, el, { resource: 'Order', action: 'update' })
    expect(removeChild).toHaveBeenCalledWith(el)
  })

  it('有权限时保留元素', () => {
    const directive = createPermissionDirective(makeService())
    const removeChild = vi.fn()
    const el = { parentNode: { removeChild } } as unknown as HTMLElement
    mounted(directive, el, { resource: 'Order', action: 'read' })
    expect(removeChild).not.toHaveBeenCalled()
  })
})
