import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  REGISTER_RECT_KEY,
  type NodeRectInfo,
} from '../editor-keys'
import { useEditorStore } from '../store/editor'

/** 让每个画布节点自行上报 DOM 几何信息，供落点指示器和框选使用 */
export function useNodeGeometry(nodeId: string, depth: number) {
  const store = useEditorStore()
  const rectRegistry = inject(REGISTER_RECT_KEY, undefined)
  const el = ref<HTMLElement | null>(null)
  let observer: ResizeObserver | null = null

  function report() {
    if (!el.value || !rectRegistry) return
    const rect = el.value.getBoundingClientRect()
    const info: NodeRectInfo = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      depth,
    }
    rectRegistry.register(nodeId, info)
  }

  onMounted(() => {
    report()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(report)
      if (el.value) observer.observe(el.value)
    }
  })

  onBeforeUnmount(() => observer?.disconnect())
  watch(() => store.zoom, report)

  return { el }
}
