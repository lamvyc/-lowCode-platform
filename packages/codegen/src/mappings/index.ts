import { registerContainerMappings } from './containers'
import { createMappingRegistry } from './registry'
import type { MappingRegistry } from './types'

/** 内置物料注册表；Task 9 / 11 / 12 会继续追加基础组件与字段 */
export function createDefaultRegistry(): MappingRegistry {
  const registry = createMappingRegistry()
  registerContainerMappings(registry)
  return registry
}
