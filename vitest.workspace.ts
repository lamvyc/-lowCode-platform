import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/schema/vitest.config.ts',
  'packages/core/vitest.config.ts',
  'packages/runtime/vitest.config.ts',
  'packages/codegen/vitest.config.ts',
])
