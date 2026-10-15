import { inject } from 'vue'
import { FIELD_CONTEXT_KEY, type FieldContext } from '@lowcode/runtime'

/**
 * 读取当前字段节点的身份（nodeId / fieldName）。
 *
 * 由 `RuntimeRenderer` 为每个声明了 `modelValue` 的节点 provide。
 * 非字段物料（文本、容器等）或物料被单独挂载时返回 `undefined`。
 *
 * 典型用法（FormItem 外壳）：
 * ```ts
 * const field = useFieldContext()
 * const runtime = useRuntimeContext()
 * const error = computed(() =>
 *   field ? runtime.value?.getFieldError(field.nodeId) : undefined,
 * )
 * ```
 */
export function useFieldContext(): FieldContext | undefined {
  return inject(FIELD_CONTEXT_KEY, undefined)
}
