import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 默认 node 环境（引擎 / 引擎逻辑等纯函数用例）。
    // 需要真实挂载的用例在文件头用 `// @vitest-environment happy-dom` 单独声明。
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
