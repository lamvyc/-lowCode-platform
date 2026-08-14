import {
  inject,
  type App,
  type DirectiveBinding,
  type InjectionKey,
  type ObjectDirective,
} from 'vue'
import type { PermissionService } from '@lowcode/core'
import type { CrudAction } from '@lowcode/schema'

/** 权限服务的 provide/inject key */
export const PERMISSION_SERVICE_KEY: InjectionKey<PermissionService> = Symbol('lc.permissionService')

/** v-permission 指令绑定值 */
export interface PermissionBindingValue {
  resource: string
  action: CrudAction
}

/** 组件内注入权限服务 */
export function usePermission(): PermissionService | undefined {
  return inject(PERMISSION_SERVICE_KEY, undefined)
}

/** 纯判定：无绑定值（或缺少 resource/action）视为放行 */
export function hasPermission(
  service: PermissionService,
  value: PermissionBindingValue | undefined,
): boolean {
  if (!value?.resource || !value?.action) return true
  return service.can(value.resource, value.action)
}

/** 创建 v-permission 指令：无权限时从 DOM 移除元素 */
export function createPermissionDirective(
  service: PermissionService,
): ObjectDirective<HTMLElement, PermissionBindingValue> {
  return {
    mounted(el, binding: DirectiveBinding<PermissionBindingValue>) {
      if (!hasPermission(service, binding.value)) {
        el.parentNode?.removeChild(el)
      }
    },
  }
}

/** 应用级安装：provide 权限服务 + 注册 v-permission 指令 */
export function installPermission(app: App, service: PermissionService): void {
  app.provide(PERMISSION_SERVICE_KEY, service)
  app.directive('permission', createPermissionDirective(service))
}
