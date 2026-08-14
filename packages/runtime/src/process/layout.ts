import type { ProcessNode, ProcessSchema } from '@lowcode/schema'

export interface ProcessLayer {
  depth: number
  nodes: ProcessNode[]
}

/**
 * 从 start 节点 BFS 分层，得到拓扑层级（供流程图按深度纵向排布）。
 * 同一层级可含并列/汇聚的节点；不可达节点被忽略。
 */
export function topologicalLayers(schema: ProcessSchema): ProcessLayer[] {
  const start = schema.spec.nodes.find((n) => n.type === 'start')
  if (!start) return []

  const depth = new Map<string, number>()
  depth.set(start.id, 0)
  const queue: string[] = [start.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    const d = depth.get(id)!
    for (const edge of schema.spec.edges) {
      if (edge.from === id && !depth.has(edge.to)) {
        depth.set(edge.to, d + 1)
        queue.push(edge.to)
      }
    }
  }

  const byDepth = new Map<number, ProcessNode[]>()
  for (const node of schema.spec.nodes) {
    const d = depth.get(node.id)
    if (d === undefined) continue
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d)!.push(node)
  }

  return [...byDepth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, nodes]) => ({ depth, nodes }))
}
