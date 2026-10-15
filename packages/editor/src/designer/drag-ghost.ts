/**
 * 拖拽浮层（ghost）：模仿 Sortable 的拖拽观感 ——
 * 浮层跟随指针移动，带投影；原始元素留在原位作为落点占位。
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
  /* ⚠️ 不要加 transition: transform：
     ① 元素创建时是 top/left = 0，若首帧没有 transform，它会先在左上角渲染一帧，
        随后的第一次移动被 transition 补间 → 肉眼看到"从左上角飘到指针"的动画；
     ② 即使补上首帧位置，每次移动都补间会让浮层恒定滞后 60ms，手感是飘而不是跟手。
     参考实现（vuedraggable / Sortable 的浮层）也是跟手、不补间。 */
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
let transparentImage: HTMLElement | null = null

/** 1×1 透明 GIF：用来顶掉浏览器默认拖拽影像 */
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function ensureGhostStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(GHOST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = GHOST_STYLE_ID
  style.textContent = GHOST_STYLES
  document.head.appendChild(style)
}

/**
 * 1×1 透明拖拽影像：用于屏蔽浏览器默认影像（否则拖拽时会出现浏览器自带的"小图标"）。
 *
 * ⚠️ 必须是**已挂载且可渲染**的元素。此前用的是 `document.createElement('canvas')`
 * 且从未 append 到 DOM —— Chrome 会忽略未渲染的元素，`setDragImage` 静默失效，
 * 于是回退到默认影像。改成挂在 body 上、移出视口的 1×1 透明 img。
 *
 * ⚠️ 也不能用 `display:none` / `visibility:hidden`：同样会被忽略。
 * 用 `position:fixed` + 负坐标移出视口，保持"已渲染"。
 */
export function transparentDragImage(): HTMLElement {
  if (!transparentImage) {
    const img = document.createElement('img')
    img.src = TRANSPARENT_PIXEL
    img.width = 1
    img.height = 1
    img.alt = ''
    img.setAttribute('aria-hidden', 'true')
    img.style.cssText =
      'position:fixed;top:-10px;left:-10px;width:1px;height:1px;pointer-events:none;border:0'
    document.body.appendChild(img)
    transparentImage = img
  }
  return transparentImage
}

export interface DragGhostOptions {
  /** 被克隆的源元素（节点 / 物料卡片）；为空时退化为纯文本 chip */
  sourceEl?: HTMLElement | null
  label: string
  /**
   * 指针位置（`dragstart` 的 clientX/clientY）。
   * ⚠️ 传它是为了**创建时就把浮层摆到位**——否则元素会先在 (0,0) 渲染一帧。
   */
  point?: { x: number; y: number }
}

/** 浮层相对指针的偏移，与 `moveDragGhost` 保持一致 */
const GHOST_OFFSET = 12

function ghostTransform(x: number, y: number): string {
  // ⚠️ 不要加 rotate()：浮层跟着指针平移时带倾角会显得在"晃"，
  // 而且拖到边缘时倾斜的角会越出画布。参考实现的浮层是正的。
  return `translate3d(${x + GHOST_OFFSET}px, ${y + GHOST_OFFSET}px, 0)`
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

  // 先摆位、后入树：否则浮层会先在左上角渲染一帧，再被补间到指针处（"从左上角飘过来"）
  if (options.point) {
    ghost.style.transform = ghostTransform(options.point.x, options.point.y)
  } else {
    // 拿不到指针就先藏起来，等第一次 moveDragGhost 再显形
    ghost.style.visibility = 'hidden'
  }
  document.body.appendChild(ghost)
  activeGhost = ghost
  return ghost
}

/** 跟随指针（固定定位元素用 translate 移动，避免触发布局） */
export function moveDragGhost(clientX: number, clientY: number): void {
  if (!activeGhost) return
  if (activeGhost.style.visibility === 'hidden') activeGhost.style.visibility = ''
  activeGhost.style.transform = ghostTransform(clientX, clientY)
}

/** 移除浮层 */
export function endDragGhost(): void {
  activeGhost?.remove()
  activeGhost = null
}
