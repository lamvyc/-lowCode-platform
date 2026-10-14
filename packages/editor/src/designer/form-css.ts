import { onBeforeUnmount, watch, type Ref } from 'vue'

/** 表单自定义 CSS 的 style 标签 id（全局唯一） */
const FORM_STYLE_ID = 'lc-form-custom-css'

/**
 * 把「表单设置」中的自定义 CSS 注入 document.head。
 * 设计器与预览共用同一份 style 标签，组件卸载时移除。
 */
export function useFormCss(cssCode: Ref<string | undefined>): void {
  if (typeof document === 'undefined') return

  function apply(css: string | undefined): void {
    const value = css ?? ''
    let element = document.getElementById(FORM_STYLE_ID) as HTMLStyleElement | null
    if (!value) {
      element?.remove()
      return
    }
    if (!element) {
      element = document.createElement('style')
      element.id = FORM_STYLE_ID
      document.head.appendChild(element)
    }
    if (element.textContent !== value) element.textContent = value
  }

  watch(cssCode, (css) => apply(css), { immediate: true })
  onBeforeUnmount(() => {
    document.getElementById(FORM_STYLE_ID)?.remove()
  })
}
