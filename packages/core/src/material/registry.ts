import type { Material, PageNode } from '@lowcode/schema'

/** 物料注册表：动态注册/查询物料，避免 Renderer 写死组件 */
export class MaterialRegistry {
  /** 已注册物料表 */
  readonly materials = new Map<string, Material>()

  register(material: Material): void {
    if (this.materials.has(material.type)) {
      throw new Error(`物料已注册: ${material.type}`)
    }
    this.materials.set(material.type, material)
  }

  registerMany(materials: Material[]): void {
    for (const material of materials) this.register(material)
  }

  get(type: string): Material | undefined {
    return this.materials.get(type)
  }

  /** 获取物料，不存在则抛错 */
  require(type: string): Material {
    const material = this.get(type)
    if (!material) throw new Error(`物料未注册: ${type}`)
    return material
  }

  has(type: string): boolean {
    return this.materials.has(type)
  }

  list(category?: string): Material[] {
    const all = [...this.materials.values()]
    return category ? all.filter((m) => m.category === category) : all
  }

  categories(): string[] {
    return [...new Set([...this.materials.values()].map((m) => m.category))]
  }

  /** 获取物料对应的 Vue 组件 */
  getComponent(type: string): unknown {
    return this.get(type)?.component
  }
}

/** 生成唯一节点 id */
export function createNodeId(prefix = 'node'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 生成唯一组件名称（如 card111927），prefix 通常为物料 type */
export function createUniqueName(prefix: string, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  const base = `${prefix}${String(Date.now() % 1_000_000).padStart(6, '0')}`
  if (!used.has(base)) return base
  let suffix = 0
  let name = base
  while (used.has(name)) {
    suffix += 1
    name = `${base}${suffix.toString(36)}`
  }
  return name
}

function deepClone<T>(value: T): T {
  return typeof value === 'object' && value !== null
    ? (JSON.parse(JSON.stringify(value)) as T)
    : value
}

/** 节点工厂：根据物料默认属性创建 PageNode */
export class NodeFactory {
  constructor(private registry: MaterialRegistry) {}

  create(
    type: string,
    overrides: { id?: string; props?: Record<string, unknown> } = {},
  ): PageNode {
    const material = this.registry.require(type)
    return {
      id: overrides.id ?? createNodeId(),
      name: createUniqueName(type),
      type,
      props: { ...deepClone(material.defaultProps), ...(overrides.props ?? {}) },
      children: material.droppable ? [] : undefined,
      slots: material.slots?.length
        ? Object.fromEntries(material.slots.map((slot) => [slot, []]))
        : undefined,
    }
  }
}
