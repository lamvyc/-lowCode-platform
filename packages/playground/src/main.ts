import { createApp } from 'vue'
import 'element-plus/dist/index.css'
// 全局最小重置：必须早于 App，见文件内注释
import './global.css'
import App from './App.vue'

createApp(App).mount('#app')
