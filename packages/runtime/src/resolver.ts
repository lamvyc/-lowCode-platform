/**
 * 组件解析器：把物料类型解析为 Vue 组件。
 * Renderer 不关心组件从哪来，只依赖这个接口。
 */
export interface IComponentResolver {
  resolve(type: string): unknown
  has(type: string): boolean
}

/** 基于 MaterialRegistry 的解析器适配器 */
export class MaterialRegistryResolver implements IComponentResolver {
  constructor(
    private registry: {
      getComponent(type: string): unknown
      has?(type: string): boolean
    },
  ) {}

  resolve(type: string): unknown {
    return this.registry.getComponent(type)
  }

  has(type: string): boolean {
    return this.registry.has?.(type) ?? false
  }
}

/** 支持动态扩展的解析器：多个解析器按顺序尝试 */
export class CompositeResolver implements IComponentResolver {
  constructor(private resolvers: IComponentResolver[]) {}

  resolve(type: string): unknown {
    for (const resolver of this.resolvers) {
      const component = resolver.resolve(type)
      if (component) return component
    }
    return undefined
  }

  has(type: string): boolean {
    return this.resolvers.some((resolver) => resolver.has(type))
  }
}
