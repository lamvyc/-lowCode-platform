import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // workspace 包以源码形式消费，交给 Vite 转译
    exclude: [
      '@lowcode/editor',
      '@lowcode/materials',
      '@lowcode/runtime',
      '@lowcode/core',
      '@lowcode/schema',
      '@lowcode/codegen',
    ],
  },
})
