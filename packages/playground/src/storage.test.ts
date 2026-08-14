import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage } from '@lowcode/core'
import {
  createEmptySchema,
  createUnifiedPageSchema,
  isSchemaEnvelope,
  type PageSchema,
  type UnifiedPageSchema,
} from '@lowcode/schema'
import { StorageRepository } from './storage'

function makeSchema(id = 'page_1', name = '页面') {
  return createEmptySchema({ id, name })
}

describe('StorageRepository', () => {
  let storage: MemoryStorage
  let repo: StorageRepository

  beforeEach(() => {
    storage = new MemoryStorage()
    repo = new StorageRepository(storage)
  })

  it('保存页面后可加载并删除', () => {
    repo.savePage(makeSchema())

    expect(repo.getPage('page_1')?.name).toBe('页面')
    expect(repo.loadPages()).toHaveLength(1)

    repo.deletePage('page_1')
    expect(repo.getPage('page_1')).toBeUndefined()
  })

  it('保存页面时更新已有页面而不是重复插入', () => {
    repo.savePage(makeSchema('page_1', '旧名'))
    repo.savePage(makeSchema('page_1', '新名'))

    expect(repo.loadPages()).toHaveLength(1)
    expect(repo.getPage('page_1')?.name).toBe('新名')
  })

  it('保存版本并支持回滚，且限制最大版本数', () => {
    repo.savePage(makeSchema())
    for (let i = 0; i < 22; i += 1) {
      repo.addVersion('page_1', makeSchema('page_1', `版本${i}`))
    }

    expect(repo.listVersions('page_1')).toHaveLength(20)
    expect((repo.listVersions('page_1')[0].schema as PageSchema).meta.name).toBe('版本21')
    const target = repo.listVersions('page_1')[1]
    expect((repo.rollback('page_1', target.id) as PageSchema).meta.name).toBe(
      (target.schema as PageSchema).meta.name,
    )
  })

  it('保存模板并支持删除', () => {
    const template = repo.saveTemplate(makeSchema(), '测试模板')

    expect(repo.listTemplates()).toHaveLength(1)
    expect(template.name).toBe('测试模板')

    repo.deleteTemplate(template.id)
    expect(repo.listTemplates()).toHaveLength(0)
  })

  it('损坏的页面数据会安全返回空列表', () => {
    storage.setItem('lc.pages', 'not-json')

    expect(repo.loadPages()).toEqual([])
  })

  it('保存并加载统一 Page Schema 保留统一结构', () => {
    const unified = createUnifiedPageSchema({ id: 'unified_1', name: '统一页面' }, {
      nodes: [{ id: 'n1', type: 'text', props: { text: 'hi' } }],
    })
    repo.savePage(unified)

    const loaded = repo.getPage('unified_1')
    expect(loaded?.name).toBe('统一页面')
    expect(isSchemaEnvelope(loaded?.schema)).toBe(true)
    expect((loaded?.schema as UnifiedPageSchema).metadata.id).toBe('unified_1')

    const template = repo.saveTemplate(unified, '统一模板')
    const copy = repo.templateToPage(template)
    expect(isSchemaEnvelope(copy)).toBe(true)
    expect((copy as UnifiedPageSchema).metadata.id).toMatch(/^page_/)
  })
})
