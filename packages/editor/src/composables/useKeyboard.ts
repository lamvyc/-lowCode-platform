import { onBeforeUnmount, onMounted } from 'vue'
import { useEditorStore } from '../store/editor'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/** 编辑器键盘快捷键：Ctrl+Z/Y、Ctrl+C/V、Delete、Ctrl+= / Ctrl+- */
export function useKeyboardShortcuts(): void {
  const store = useEditorStore()

  const onKeydown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()

    if (mod && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      store.undo()
    } else if ((mod && key === 'y') || (mod && key === 'z' && event.shiftKey)) {
      event.preventDefault()
      store.redo()
    } else if (mod && key === 'c') {
      event.preventDefault()
      store.copySelected()
    } else if (mod && key === 'v') {
      event.preventDefault()
      store.paste()
    } else if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      store.removeSelected()
    } else if (mod && key === '=') {
      event.preventDefault()
      store.setZoom(store.zoom + 0.1)
    } else if (mod && key === '-') {
      event.preventDefault()
      store.setZoom(store.zoom - 0.1)
    } else if (mod && key === '0') {
      event.preventDefault()
      store.setZoom(1)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
