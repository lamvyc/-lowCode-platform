import { createApp } from 'vue'
import { PermissionService } from '@lowcode/core'
import { installPermission } from '@lowcode/runtime'
import App from './App.vue'

const app = createApp(App)

// 演示：假用户 + 权限声明，注册 v-permission 指令与权限服务
const permission = new PermissionService({ id: 'demo-admin', name: '演示管理员', roles: ['admin'] })
permission.setPermissions('Order', {
  table: [{ role: 'admin', action: 'full' }],
  operation: [{ role: 'admin', actions: ['create', 'read', 'update'] }],
})
installPermission(app, permission)

app.mount('#app')
