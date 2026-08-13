import { inject } from 'vue'
import { RUNTIME_CONTEXT_KEY, type RuntimeContext } from '@lowcode/runtime'

/** 物料组件读取运行时上下文（弹窗状态等） */
export function useRuntimeContext(): RuntimeContext | undefined {
  return inject(RUNTIME_CONTEXT_KEY, undefined)
}
