import { computed, inject, type ComputedRef } from 'vue'
import { RUNTIME_CONTEXT_KEY, type RuntimeContext } from '@lowcode/runtime'

/**
 * 物料组件读取运行时上下文（表单设置、字段值等）。
 *
 * 返回**计算引用**而不是上下文对象本身：编辑器每次 schema 变更都会重建
 * `RuntimeContext`，若在 setup 里一次性取出对象，上下文被替换后就会变陈旧
 * （典型表现：改「表单设置」里的标签宽度/对齐，画布上的字段标签不更新）。
 *
 * 用法：`const runtime = useRuntimeContext()` → `runtime.value?.schema`
 */
export function useRuntimeContext(): ComputedRef<RuntimeContext | undefined> {
  const contextRef = inject(RUNTIME_CONTEXT_KEY, undefined)
  return computed(() => contextRef?.value)
}
