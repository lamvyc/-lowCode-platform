import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import type { PageSchema } from '@lowcode/schema'
import { cloneSchema } from '@lowcode/schema'

// Immer 的补丁能力需要显式启用
enablePatches()

export interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
  op?: string
  timestamp: number
  mergeKey?: string
}

export interface HistoryOptions {
  /** 最大撤销深度 */
  maxDepth?: number
  /** 相同 mergeKey 的合并时间窗口（毫秒） */
  mergeWindowMs?: number
}

/**
 * 历史管理器：基于 Immer Patch 实现 undo/redo。
 * 所有对 schema 的修改都通过 record() 进入历史，保证可撤销。
 */
export class HistoryManager {
  private currentSchema: PageSchema
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private options: Required<HistoryOptions>

  constructor(schema: PageSchema, options: HistoryOptions = {}) {
    this.currentSchema = cloneSchema(schema)
    this.options = {
      maxDepth: options.maxDepth ?? 100,
      mergeWindowMs: options.mergeWindowMs ?? 800,
    }
  }

  get current(): PageSchema {
    return this.currentSchema
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get depth(): number {
    return this.undoStack.length
  }

  /**
   * 记录一次修改：recipe 直接修改 draft schema。
   * 相同 mergeKey 在窗口内合并为一条历史（如连续输入）。
   */
  record(recipe: (draft: PageSchema) => void, op?: string, mergeKey?: string): PageSchema {
    const [next, patches, inversePatches] = produceWithPatches(this.currentSchema, recipe)
    if (patches.length === 0) return this.currentSchema

    const now = Date.now()
    const top = this.undoStack[this.undoStack.length - 1]
    if (
      mergeKey &&
      top?.mergeKey === mergeKey &&
      now - top.timestamp <= this.options.mergeWindowMs
    ) {
      // 合并：正向补丁按时间顺序拼接；反向补丁需要倒序拼接
      top.patches = [...top.patches, ...patches]
      top.inversePatches = [...inversePatches, ...top.inversePatches]
      top.timestamp = now
      top.op = op ?? top.op
    } else {
      this.undoStack.push({ patches, inversePatches, op, timestamp: now, mergeKey })
      if (this.undoStack.length > this.options.maxDepth) {
        this.undoStack.shift()
      }
    }

    this.redoStack = []
    this.currentSchema = next as PageSchema
    return this.currentSchema
  }

  undo(): PageSchema | undefined {
    const entry = this.undoStack.pop()
    if (!entry) return undefined
    this.currentSchema = applyPatches(this.currentSchema, entry.inversePatches) as PageSchema
    this.redoStack.push(entry)
    return this.currentSchema
  }

  redo(): PageSchema | undefined {
    const entry = this.redoStack.pop()
    if (!entry) return undefined
    this.currentSchema = applyPatches(this.currentSchema, entry.patches) as PageSchema
    this.undoStack.push(entry)
    return this.currentSchema
  }

  /** 重置为指定 schema（如加载页面），不产生历史 */
  reset(schema: PageSchema): void {
    this.currentSchema = cloneSchema(schema)
    this.undoStack = []
    this.redoStack = []
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
