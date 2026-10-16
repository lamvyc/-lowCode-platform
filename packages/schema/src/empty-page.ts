import { SCHEMA_VERSION } from './validation/validate'
import type { PageMeta, PageSchema } from './types/page'

/**
 * 空页面 schema：**画布初始就是空的**，与参考实现一致
 * （参考启动时画布为空，只显示 `请从左侧列表中选择一个组件…` 的提示）。
 *
 * 之前的 playground 直接注入一份「用户管理示例」的完整 schema，
 * 于是"新打开设计器"看到的是一个已经搭好的页面——既不是参考实现的行为，
 * 也容易让人误以为那些节点是自动生成的。
 *
 * 演示用的那份 schema 已删除（需要时从 git 历史取回）。要展示能力，
 * 应该走「页面模板」那条路（`templateRegistry`），而不是默认塞进画布。
 */
export function createEmptyPageSchema(meta: Partial<PageMeta> = {}): PageSchema {
  const now = new Date().toISOString()
  return {
    version: SCHEMA_VERSION,
    meta: {
      id: meta.id ?? 'page',
      name: meta.name ?? '未命名页面',
      description: meta.description ?? '',
      route: meta.route ?? '/',
      createdAt: meta.createdAt ?? now,
      updatedAt: meta.updatedAt ?? now,
    },
    nodes: [],
    materials: [],
    dataSources: [],
    variables: [],
    rules: [],
  }
}
