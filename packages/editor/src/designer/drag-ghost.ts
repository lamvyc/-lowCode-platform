/**
 * 拖拽浮层（ghost）：模仿 Sortable 的拖拽观感 ——
 * 浮层跟随指针移动，带轻微旋转与投影，原始元素留在原位作为落点占位。
 *
 * 同时把浏览器默认拖拽影像替换为 1×1 透明画布，避免出现"两个影像"。
 */

const GHOST_STYLE_ID = 'lc-drag-ghost-style'

const GHOST_STYLES = `
.lc-drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 4000;
  pointer-events: none;
  background: #fff;
  border-radius: 4px;
  opacity: 0.92;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  will-change: transform;
  transition: transform 60ms linear;
}
.lc-drag-ghost__label {
  position: absolute;
  top: -20px;
  left: 0;
  padding: 1px 7px;
  border-radius: 3px;
  background: #3370ff;
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}
.lc-drag-ghost--chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid #3370ff;
  background: #f5f8ff;
  color: #3370ff;
  font-size: 13px;
}
`

let activeGhost: HTMLElement | null = null
let transparentImage: HTMLCanvasElement | null = null

function ensureGhostStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(GHOST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = GHOST_STYLE_ID
  style.textContent = GHOST_STYLES
  document.head.appendChild(style)
}

/** 1×1 透明拖拽影像：用于屏蔽浏览器默认影像 */
export function transparentDragImage(): HTMLCanvasElement {
  if (!transparentImage) {
    transparentImage = document.createElement('canvas')
    transparentImage.width = 1
    transparentImage.height = 1
  }
  return transparentImage
}

export interface DragGhostOptions {
  /** 被克隆的源元素（节点 / 物料卡片）；为空时退化为纯文本 chip */
  sourceEl?: HTMLElement | null
  label: string
}

/** 创建拖拽浮层并接管为当前活动浮层 */
export function beginDragGhost(options: DragGhostOptions): HTMLElement | null {
  if (typeof document === 'undefined') return null
  ensureGhostStyles()
  endDragGhost()

  const { sourceEl, label } = options
  const ghost = document.createElement('div')
  ghost.className = 'lc-drag-ghost'

  const rect = sourceEl?.getBoundingClientRect()
  if (sourceEl && rect && rect.width > 0 && rect.height > 0) {
    const clone = sourceEl.cloneNode(true) as HTMLElement
    // 浮层里不需要画布装饰（选中框 / 手柄 / 操作条）
    clone
      .querySelectorAll('.lc-node__badges, .lc-node__actions')
      .forEach((element) => element.remove())
    clone.classList.remove('lc-node--selected', 'lc-node--hovered', 'lc-node--dragging')
    clone.style.width = `${Math.round(rect.width)}px`
    clone.style.height = `${Math.round(rect.height)}px`
    clone.style.margin = '0'
    ghost.appendChild(clone)
  } else {
    ghost.classList.add('lc-drag-ghost--chip')
    ghost.textContent = label
  }

  const badge = document.createElement('span')
  badge.className = 'lc-drag-ghost__label'
  badge.textContent = label
  ghost.appendChild(badge)

  document.body.appendChild(ghost)
  activeGhost = ghost
  return ghost
}

/** 跟随指针（固定定位元素用 translate 移动，避免触发布局） */
export function moveDragGhost(clientX: number, clientY: number): void {
  if (!activeGhost) return
  activeGhost.style.transform = `translate3d(${clientX + 12}px, ${clientY + 12}px, 0) rotate(1.5deg)`
}

/** 移除浮层 */
export function endDragGhost(): void {
  activeGhost?.remove()
  activeGhost = null
}
