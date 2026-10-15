import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 默认 node 环境（清单 / 一致性审计等纯逻辑用例）。
    // 需要真实挂载的用例在文件头用 `// @vitest-environment happy-dom` 单独声明，
    // 避免给全部用例套上 DOM 环境。
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
