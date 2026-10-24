import type {
  ComponentMapping,
  ElementMapping,
  MappingRegistry,
} from './types'

/** 创建空映射注册表；内置物料由 mappings/index.ts 的 createDefaultRegistry 注册 */
export function createMappingRegistry(): MappingRegistry {
  const mappings = new Map<string, ElementMapping>()
  const components = new Map<string, ComponentMapping>()

  return {
    register(type, mapping) {
      mappings.set(type, mapping)
    },
    get(type) {
      return mappings.get(type)
    },
    registerComponent(type, entry) {
      components.set(type, entry)
    },
    component(type) {
      return components.get(type)
    },
  }
}
