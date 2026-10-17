#!/usr/bin/env node
/**
 * 真机验收套件：把"happy-dom 覆盖不到"的行为固化成可复跑的检查。
 *
 * 为什么需要它：本项目此前的 bug 几乎全是**真实浏览器里才暴露**的
 * （上游 CSS 语义变化、真实鼠标事件序列、布局引擎相关），而 happy-dom 没有布局引擎、
 * 合成事件也模拟不了原生拖拽。这些探针原先散落在临时脚本里，跑完就没了。
 *
 * 每个检查 = 一个独立的浏览器会话（页面状态互相隔离），断言表达式返回 `{ok, detail}`，
 * 有失败即以非零码退出。
 *
 * 用法：
 *   pnpm verify:browser                      # 自动探测 5173 / 5174
 *   pnpm verify:browser -- --url http://localhost:5174/
 *   pnpm verify:browser -- --only radio      # 只跑名字里含 radio 的
 *
 * 前置：需要一个跑着的 dev server（`pnpm dev`）。本脚本**不自己起服务**——
 * 起停服务交给调用方，避免脚本里藏一个难以观察的长驻进程。
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const INSPECT = join(HERE, 'cdp-inspect.mjs')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 页面内的取上下文工具（dev 模式下从 Vue 实例树里拿到 DesignerContext） */
const GETCTX = `const __unref = (v) => (v && typeof v === 'object' && v.__v_isRef ? v.value : v)
const __getCtx = () => {
  const app = document.querySelector('#app').__vue_app__
  const seen = new Set(); let result = null
  const visit = (vnode, d) => {
    if (!vnode || d > 60) return
    if (vnode.component) walk(vnode.component, d + 1)
    if (Array.isArray(vnode.children)) vnode.children.forEach((k) => visit(k, d + 1))
    else if (vnode.children && typeof vnode.children === 'object') {
      for (const s of Object.values(vnode.children)) {
        if (typeof s === 'function') { try { const r = s(); (Array.isArray(r) ? r : [r]).forEach((x) => visit(x, d + 1)) } catch {} }
      }
    }
  }
  const walk = (inst, d) => {
    if (!inst || seen.has(inst) || result) return
    seen.add(inst)
    if ((inst.type?.__name || inst.type?.name) === 'Designer') { result = inst.setupState.ctx; return }
    visit(inst.subTree, d)
  }
  walk(app._instance, 0)
  return result
}
`

/** 插入一个物料并等它渲染，返回新节点 id 挂到 window.__t */
const insertMaterial = (type) => `(async () => {
  ${GETCTX}
  const ctx = __getCtx()
  const ids = () => [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
  const before = new Set(ids())
  ctx.insertMaterial('${type}')
  await new Promise((r) => setTimeout(r, 800))
  window.__t = ids().find((x) => !before.has(x))
  window.__before = [...ids()]
  return window.__t || 'NO_NODE'
})()`

/**
 * 连续插入多个物料，新节点 id 依次记到 `window.__ids`。
 *
 * ⚠️ 画布初始是**空的**（对齐参考实现），所以检查必须自己造数据，
 * 不能再依赖固定的演示节点 id（此前用的是 n_title / n_button）。
 */
const insertMaterials = (types) => `(async () => {
  ${GETCTX}
  const ctx = __getCtx()
  const ids = () => [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
  window.__ids = []
  for (const type of ${JSON.stringify(types)}) {
    const before = new Set(ids())
    ctx.insertMaterial(type)
    await new Promise((r) => setTimeout(r, 800))
    const id = ids().find((x) => !before.has(x))
    if (!id) return 'NO_NODE:' + type
    window.__ids.push(id)
  }
  return JSON.stringify(window.__ids)
})()`

/**
 * 把节点用 `bindings.visible` 隐藏：**不渲染，但仍占着 schema 的顺序槽位**。
 *
 * 这正是 `drop-at-bottom-appends` 要复现的场景（原 bug 与 questionBug.md question3 同根因）。
 * 此前这条检查是靠演示 schema 里那个隐藏的 `n_input` 制造场景的——
 * 画布改为初始为空后场景就没了，检查会**悄悄失去牙齿**（继续通过，但什么也没验）。
 * 现在它自己造隐藏兄弟。
 */
const hideNode = (indexExpr) => `(() => {
  ${GETCTX}
  const ctx = __getCtx()
  const id = window.__ids[${indexExpr}]
  ctx.updateNode(id, (n) => ({
    ...n,
    bindings: { ...(n.bindings ?? {}), visible: { type: 'expression', value: 'false' } },
  }))
  return 'ok'
})()`

const setProps = (patch) =>
  `(() => { ${GETCTX} __getCtx().updateProps(window.__t, ${JSON.stringify(patch)}); return 'ok' })()`

/** 数某个选择器的"不同行数"（真实布局引擎下才有意义） */
const rowCheck = (selector, expectRows, label) => ({
  label,
  check: `(() => {
    const root = document.querySelector('.lc-canvas [data-node-id="' + window.__t + '"]')
    if (!root) return { ok: false, detail: { error: '节点 DOM 未找到' } }
    const opts = [...root.querySelectorAll('${selector}')]
    const rows = new Set(opts.map((el) => Math.round(el.getBoundingClientRect().top))).size
    const displays = [...new Set(opts.map((el) => getComputedStyle(el).display))]
    return { ok: opts.length > 0 && rows === ${expectRows}, detail: { count: opts.length, rows, expectRows: ${expectRows}, displays } }
  })()`,
})

const computedCheck = (selector, expectDisplay, label) => ({
  label,
  check: `(() => {
    const root = document.querySelector('.lc-canvas [data-node-id="' + window.__t + '"]')
    const el = root && root.querySelector('${selector}')
    if (!el) return { ok: false, detail: { error: '元素未找到' } }
    const computed = getComputedStyle(el).display
    return { ok: computed === '${expectDisplay}', detail: { computed, expect: '${expectDisplay}' } }
  })()`,
})

/** schema 根层顺序（含隐藏节点）+ 可见顺序 */
const orderCheck = (expectFn, label) => ({
  label,
  check: `(() => {
    ${GETCTX}
    const nodes = __unref(__getCtx().schema).nodes
    const ref = new Set()
    for (const n of nodes) {
      ;(n.children ?? []).forEach((c) => ref.add(c))
      Object.values(n.slots ?? {}).forEach((ids) => ids.forEach((i) => ref.add(i)))
    }
    const rootIds = nodes.filter((n) => !ref.has(n.id)).map((n) => n.id)
    const visible = [...document.querySelectorAll('.lc-canvas [data-node-id]')]
      .filter((el) => !el.parentElement.closest('[data-node-id]'))
      .map((e) => e.dataset.nodeId)
    return { ok: (${expectFn})(rootIds, visible), detail: { rootIds, visible } }
  })()`,
})

const CHECKS = [
  {
    name: 'canvas-smoke',
    why: '画布初始为空并显示空态（与参考实现一致），且插入物料后能正常渲染、不降级成错误占位',
    steps: [
      {
        label: '初始画布为空且显示空态提示',
        check: `(() => {
          const root = !!document.querySelector('.lc-runtime-root')
          const empty = !!document.querySelector('.lc-canvas__empty')
          const nodes = document.querySelectorAll('.lc-canvas [data-node-id]').length
          return { ok: root && empty && nodes === 0, detail: { root, empty, nodes } }
        })()`,
      },
      { eval: insertMaterials(['input']) },
      { wait: 300 },
      {
        label: '插入物料后渲染出来，且无 .lc-render-error / .lc-missing',
        check: `(() => {
          const errs = document.querySelectorAll('.lc-render-error').length
          const missing = document.querySelectorAll('.lc-missing').length
          const nodes = document.querySelectorAll('.lc-canvas [data-node-id]').length
          const empty = !!document.querySelector('.lc-canvas__empty')
          const input = !!document.querySelector('.lc-canvas .lc-runtime-root input')
          return { ok: errs === 0 && missing === 0 && nodes === 1 && !empty && input, detail: { errs, missing, nodes, empty, input } }
        })()`,
      },
    ],
  },

  {
    name: 'palette-alignment',
    why: '物料面板的分组/标签/图标要对齐参考实现。manifest 层已由 palette.test.ts 守住，这里守**渲染层**——图标是否真的渲染成 SVG、title 是否只放标签，都只有真实 DOM 能验',
    steps: [
      {
        label: '4 个分组、参考的 18 项基础字段顺序一致、每项有 SVG 图标、title 等于标签',
        check: `(() => {
          const t = (el) => (el && el.textContent ? el.textContent.trim() : '')
          const groups = [...document.querySelectorAll('.lc-material-panel__list .el-collapse-item')].map((g) => {
            const head = g.querySelector('.lc-group__header > span:first-child')
            return {
              group: head ? t(head) : '?',
              items: [...g.querySelectorAll('.lc-material-item')].map((el) => ({
                label: t(el.querySelector('.lc-material-item__name')),
                title: el.getAttribute('title'),
                hasSvg: !!el.querySelector('svg'),
              })),
            }
          })
          const groupNames = groups.map((g) => g.group)
          const expectGroups = ['容器', '基础字段', '高级字段', '自定义扩展字段']
          const all = groups.flatMap((g) => g.items)
          const noSvg = all.filter((i) => !i.hasSvg).map((i) => i.label)
          const badTitles = all.filter((i) => i.title !== i.label).map((i) => i.label)
          const base = groups[1] ? groups[1].items.slice(0, 18).map((i) => i.label) : []
          const expectBase = ['单行输入','多行输入','计数器','单选项','多选项','下拉选项','时间','时间范围','日期','日期范围','开关','评分','颜色选择器','滑块','静态文字','HTML','按钮','分隔线']
          return {
            ok: JSON.stringify(groupNames) === JSON.stringify(expectGroups)
              && noSvg.length === 0 && badTitles.length === 0
              && JSON.stringify(base) === JSON.stringify(expectBase),
            detail: { groupNames, noSvg, badTitles, 基础字段前18项: base },
          }
        })()`,
      },
    ],
  },

  {
    name: 'radio-displayStyle',
    why: 'Element Plus 把 .el-radio-group 改成 inline-flex 会让选项 display 被块化，displayStyle 静默失效（已用 :deep 恢复 inline-block）',
    steps: [
      { eval: insertMaterial('radio') },
      { eval: setProps({ displayStyle: 'block' }) },
      { wait: 450 },
      rowCheck('.el-radio', 3, 'displayStyle=block → 3 行'),
      { eval: setProps({ displayStyle: 'inline' }) },
      { wait: 450 },
      rowCheck('.el-radio', 1, 'displayStyle=inline → 1 行'),
    ],
  },

  {
    name: 'checkbox-displayStyle',
    why: '原先只在 block 时设样式，inline 会落到 EP 默认的 inline-flex（参考实现给的是 inline，两者间距/基线不等价）',
    steps: [
      { eval: insertMaterial('checkbox') },
      { eval: setProps({ displayStyle: 'inline' }) },
      { wait: 450 },
      computedCheck('.el-checkbox', 'inline', 'inline 时 computed 是 inline（而非 inline-flex）'),
      { eval: setProps({ displayStyle: 'block' }) },
      { wait: 450 },
      rowCheck('.el-checkbox', 3, 'displayStyle=block → 3 行'),
    ],
  },

  {
    name: 'input-placeholder',
    why: 'placeholder 默认值应为空串（参考实现如此，无兜底文案）',
    steps: [
      { eval: insertMaterial('input') },
      {
        label: '默认 placeholder 为空',
        check: `(() => {
          const root = document.querySelector('.lc-canvas [data-node-id="' + window.__t + '"]')
          const el = root && root.querySelector('input')
          const attr = el ? el.getAttribute('placeholder') : null
          return { ok: attr === '', detail: { placeholder: attr } }
        })()`,
      },
      { eval: setProps({ placeholder: '请输入姓名' }) },
      { wait: 400 },
      {
        label: '设置后 placeholder 透传到原生 input',
        check: `(() => {
          const root = document.querySelector('.lc-canvas [data-node-id="' + window.__t + '"]')
          const el = root && root.querySelector('input')
          const attr = el ? el.getAttribute('placeholder') : null
          return { ok: attr === '请输入姓名', detail: { placeholder: attr } }
        })()`,
      },
    ],
  },

  {
    name: 'formitem-no-hint',
    why: 'requiredHint / validationHint 是**校验失败时的错误文案**，不是常显提示（曾被当说明文字永久渲染）',
    steps: [
      { eval: insertMaterial('input') },
      { eval: setProps({ label: '姓名', required: true, requiredHint: '请填写姓名', validationHint: '格式不对' }) },
      { wait: 450 },
      {
        label: '两个文案都不在 DOM，必填星号仍在',
        check: `(() => {
          const root = document.querySelector('.lc-canvas [data-node-id="' + window.__t + '"]')
          if (!root) return { ok: false, detail: { error: '未找到节点' } }
          const text = root.textContent || ''
          const hasHintEl = !!root.querySelector('.lc-form-item__hint')
          const hasStar = !!root.querySelector('.lc-form-item__required')
          return {
            ok: !hasHintEl && !text.includes('请填写姓名') && !text.includes('格式不对') && hasStar,
            detail: { hasHintEl, requiredHintInDom: text.includes('请填写姓名'), validationHintInDom: text.includes('格式不对'), hasStar },
          }
        })()`,
      },
    ],
  },

  {
    name: 'validation-in-preview',
    why: '校验错误的出现与消失时机——纯 UI 时序，SSR / vnode 断言都测不到',
    steps: [
      { eval: insertMaterial('input') },
      { eval: setProps({ label: '邮箱', required: true }) },
      { wait: 400 },
      {
        eval: `(async () => {
          ${GETCTX}
          __getCtx().togglePreview()
          await new Promise((r) => setTimeout(r, 900))
          const items = [...document.querySelectorAll('.lc-preview-body .lc-form-item')]
          const target = items.find((el) => (el.querySelector('.lc-form-item__label')?.textContent ?? '').includes('邮箱'))
          const input = target && target.querySelector('input')
          if (input) input.id = 'target-input'
          return input ? 'ok' : 'NO_INPUT'
        })()`,
      },
      { click: '#target-input' },
      { click: '.lc-preview-bar' },
      { wait: 300 },
      {
        label: '空值失焦 → 出现「字段值不可为空」',
        check: `(() => {
          const errs = [...document.querySelectorAll('.lc-form-item__error')].map((e) => e.textContent.trim())
          return { ok: errs.length === 1 && errs[0] === '字段值不可为空', detail: { errs } }
        })()`,
      },
      { click: '#target-input' },
      { type: 'abc' },
      { click: '.lc-preview-bar' },
      { wait: 300 },
      {
        label: '填入值后失焦 → 过期错误被清除',
        check: `(() => {
          const errs = [...document.querySelectorAll('.lc-form-item__error')].map((e) => e.textContent.trim())
          const value = document.querySelector('#target-input')?.value
          return { ok: errs.length === 0 && value === 'abc', detail: { errs, value } }
        })()`,
      },
    ],
  },

  {
    name: 'drag-ghost-follows-pointer',
    why: '拖拽浮层曾在创建时落在 (0,0)、再被 60ms transition 补间到指针——肉眼就是"从左上角飘过来"。这里断言拖拽**进行中**浮层贴在指针旁、且没有 transition。只有真实鼠标拖拽 + 真实布局才测得到',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: `(() => {
          const f = document.querySelector('.lc-runtime-root').getBoundingClientRect()
          window.__end = { x: Math.round(f.left + 300), y: Math.round(f.top + 200) }
          return 'ok'
        })()` },
      { dragHold: { from: '[title="单行输入"]', toExpr: 'window.__end', steps: 18 } },
      {
        label: '浮层贴在指针旁、不倾斜、无 transition 补间；透明拖拽影像已挂载',
        check: `(() => {
          const g = document.querySelector('.lc-drag-ghost')
          if (!g) return { ok: false, detail: { error: '未找到拖拽浮层' } }
          const b = g.getBoundingClientRect()
          const c = getComputedStyle(g)
          const want = { x: window.__end.x + 12, y: window.__end.y + 12 }
          const dist = Math.round(Math.hypot(b.left - want.x, b.top - want.y))
          const atOrigin = b.left < 40 && b.top < 40
          const hasTransition = c.transitionDuration !== '0s'
          // 从 transform 矩阵解出旋转角：matrix(a,b,c,d,e,f) → atan2(b, a)
          const m = new DOMMatrixReadOnly(c.transform)
          const tilt = Math.abs(Math.atan2(m.b, m.a) * 180 / Math.PI)
          // 顶掉浏览器默认拖拽影像的 1×1 透明元素必须**已挂载且可渲染**
          // （未挂载 / display:none / visibility:hidden 都会被 Chrome 忽略，默认影像就会露出来）
          const carrier = [...document.querySelectorAll('body > img[aria-hidden="true"]')]
            .find((i) => i.src.startsWith('data:image/gif'))
          const carrierOk = !!carrier && carrier.width === 1 && carrier.height === 1
            && getComputedStyle(carrier).display !== 'none'
            && getComputedStyle(carrier).visibility === 'visible'
          return {
            ok: dist <= 12 && !atOrigin && !hasTransition && tilt < 0.01 && carrierOk,
            detail: { 距指针: dist, 在左上角: atOrigin, transition: c.transitionDuration,
                      倾斜角度: Math.round(tilt * 100) / 100, 透明影像已挂载: carrierOk },
          }
        })()`,
      },
      { release: true },
      { wait: 300 },
      {
        label: '释放后浮层已清理',
        check: `(() => ({ ok: !document.querySelector('.lc-drag-ghost'), detail: { 残留: !!document.querySelector('.lc-drag-ghost') } }))()`,
      },
    ],
  },

  {
    name: 'drop-at-bottom-appends',
    why: '落点索引曾按「可见子节点」算却当 schema 索引用——中间夹一个隐藏兄弟就会整体偏移（与 questionBug.md question3 同根因）。这里自己造出"中间有隐藏节点"的场景',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['input', 'textarea', 'input']) },
      { eval: hideNode(1) },
      { wait: 500 },
      {
        label: '中间那个节点已隐藏（DOM 里 2 个，schema 里仍是 3 个）',
        check: `(() => {
          ${GETCTX}
          const dom = document.querySelectorAll('.lc-canvas [data-node-id]').length
          const schema = __unref(__getCtx().schema).nodes.length
          return { ok: dom === 2 && schema === 3, detail: { dom, schema } }
        })()`,
      },
      {
        // ⚠️ 必须取 **schema** 的 id 而不是 DOM 的：隐藏节点不在 DOM 里，
        // 用 DOM id 求差集会把它误判成"新插入的节点"（实测踩过，反向验证因此假红）。
        eval: `(() => { ${GETCTX} window.__before = __unref(__getCtx().schema).nodes.map((n) => n.id); return 'ok' })()`,
      },
      { eval: tagMaterial('单行输入') },
      {
        eval: `(() => {
          const r = document.querySelector('.lc-canvas').getBoundingClientRect()
          window.__drop = { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - 30) }
          return 'ok'
        })()`,
      },
      { drag: { from: '#drag-source', toExpr: 'window.__drop', steps: 16 } },
      { wait: 500 },
      {
        eval: `(() => {
          const ctx = __getCtx()
          const ids = __unref(ctx.schema).nodes.map((n) => n.id)
          window.__newId2 = ids.find((i) => !window.__before.includes(i))
          return window.__newId2 || 'NONE'
        })()`,
      },
      orderCheck(
        // ⚠️ 不能写 `rootIds.at(-1).startsWith('node_')` —— 生成 id **全都**以 node_ 开头，
        // 那样断言恒真，检查等于没写（回退修复都不会变红，实测踩过）。
        `(rootIds) => rootIds[rootIds.length - 1] === window.__newId2`,
        '拖到画布底部 → 新节点落在 schema 根层**末尾**（而不是被中间的隐藏节点挤偏）',
      ),
    ],
  },

  {
    name: 'material-drag-to-top',
    why: '物料拖入的顶部落点：应插到最前',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: `window.__before = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId); 'ok'` },
      { eval: tagMaterial('单行输入') },
      {
        eval: `(() => {
          const rr = document.querySelector('.lc-runtime-root').getBoundingClientRect()
          window.__drop = { x: Math.round(rr.left + rr.width / 2), y: Math.round(rr.top + 3) }
          return 'ok'
        })()`,
      },
      { drag: { from: '#drag-source', toExpr: 'window.__drop', steps: 16 } },
      { wait: 500 },
      {
        eval: `(() => {
          const ctx = __getCtx()
          const ids = __unref(ctx.schema).nodes.map((n) => n.id)
          window.__newId2 = ids.find((i) => !(window.__before || []).includes(i))
          return window.__newId2 || 'NONE'
        })()`,
      },
      orderCheck(
        // 同上：必须断言"可见顺序首位就是这个新节点"，不能只断言它像一个新 id
        `(rootIds, visible) => visible[0] === window.__newId2`,
        '拖到画布顶部 → 新节点可见顺序在**最前**',
      ),
    ],
  },

  {
    name: 'node-reorder-to-front',
    why: 'NodeTree.resolveIndex 的 beforeId 对根级 PageNode[] 列表永远不匹配，退化成"总是追加到末尾"——表现为把节点拖到最前没反应',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['input', 'textarea']) },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const target = window.__ids[1]
          ctx.selectNode(target)
          await new Promise((r) => setTimeout(r, 500))
          const h = document.querySelector('[data-node-id="' + target + '"] .lc-node__badges')
          if (!h) return 'NO_HANDLE'
          h.id = 'node-handle'
          const rr = document.querySelector('.lc-runtime-root').getBoundingClientRect()
          window.__drop = { x: Math.round(rr.left + rr.width / 2), y: Math.round(rr.top + 3) }
          return 'ok'
        })()`,
      },
      { drag: { from: '#node-handle', toExpr: 'window.__drop', steps: 16 } },
      { wait: 500 },
      orderCheck(
        `(rootIds) => rootIds[0] === window.__ids[1]`,
        '真实鼠标把最后一个节点拖到最前 → schema 根顺序首位变成它',
      ),
    ],
  },

  {
    name: 'node-move-real-mouse',
    why: 'questionBug.md question2：点击上移/下移后选中态会跳到相邻组件（合成 click 测不出，必须真实鼠标）',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['input', 'textarea']) },
      {
        eval: `(() => {
          // 真实鼠标点击需要稳定的选择器，给第一个节点打个 id
          document.querySelector('[data-node-id="' + window.__ids[0] + '"]').id = 'target-node'
          return 'ok'
        })()`,
      },
      { click: '#target-node' },
      { wait: 300 },
      {
        label: '点击后选中该节点',
        check: `(() => { ${GETCTX} const s = __getCtx().state.selectedNodeId; return { ok: s === window.__ids[0], detail: { selected: s, want: window.__ids[0] } } })()`,
      },
      { click: 'button[title="下移"]' },
      { wait: 500 },
      {
        label: '下移后选中态仍停在原节点（未跳到相邻组件）',
        check: `(() => {
          ${GETCTX}
          const s = __getCtx().state.selectedNodeId
          const order = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
          return { ok: s === window.__ids[0] && order.indexOf(window.__ids[0]) === 1, detail: { selected: s, order } }
        })()`,
      },
    ],
  },

  {
    name: 'rich-editor',
    why: '富文本从「自建 contenteditable + document.execCommand」换成了 Quill（@vueup/vue-quill）。三件事都只有真实浏览器能验：Quill 工具栏是否渲染、输入是否回写到运行期值、工具栏按钮是否真的生效',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['rich-editor']) },
      { wait: 400 },
      {
        label: 'Quill 工具栏渲染出来，编辑区可编辑',
        check: `(() => {
          const tb = document.querySelector('.lc-canvas .ql-toolbar')
          const ed = document.querySelector('.lc-canvas .ql-editor')
          const count = tb ? tb.querySelectorAll('button, .ql-picker').length : 0
          return {
            ok: !!tb && !!ed && ed.getAttribute('contenteditable') === 'true' && count >= 15,
            detail: { 工具栏: !!tb, 按钮数: count, 编辑区: !!ed, contenteditable: ed ? ed.getAttribute('contenteditable') : null },
          }
        })()`,
      },
      { eval: `(() => { const ed = document.querySelector('.lc-canvas .ql-editor'); if (!ed) return 'NO_EDITOR'; ed.id = 'rte'; return 'ok' })()` },
      { click: '#rte' },
      { type: 'Hello' },
      { wait: 500 },
      {
        label: '输入的内容回写到运行期值（getNodeValue）',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const id = window.__ids[0]
          const rt = __unref(ctx.runtime)
          const value = String(rt.getNodeValue(id) ?? '')
          return { ok: value.includes('Hello'), detail: { value: value.slice(0, 60) } }
        })()`,
      },
      {
        label: '点工具栏「加粗」后继续输入，内容带上 <strong>',
        check: `(() => {
          const tb = document.querySelector('.lc-canvas .ql-toolbar')
          const bold = tb && tb.querySelector('button.ql-bold')
          return { ok: !!bold, detail: { 加粗按钮: !!bold } }
        })()`,
      },
      { click: '.lc-canvas .ql-toolbar button.ql-bold' },
      { click: '#rte' },
      { type: 'Bold' },
      { wait: 500 },
      {
        label: '加粗生效（HTML 里出现 strong 或 font-weight）',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const value = String(__unref(ctx.runtime).getNodeValue(window.__ids[0]) ?? '')
          const ok = /<strong|font-weight:\s*bold/i.test(value)
          return { ok, detail: { value: value.slice(0, 90) } }
        })()`,
      },
    ],
  },

  {
    name: 'props-effect-precise',
    why: '属性 → 渲染 的扫描（scripts/props-effect.py）只验「有没有反应」，不验「反应对不对」。设了 disabled 输入框确实变了，但变的真是"禁用"吗？这一组对最常用的 10 个属性下精确断言',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        label: '10 个关键属性的效果精确匹配',
        check: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
          ctx.insertMaterial('input')
          await tick(120)
          const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
          if (!id) return { ok: false, detail: { 错误: '没插入成功' } }

          const root = () => document.querySelector('[data-node-id="' + id + '"]')
          const q = (sel) => (root() ? root().querySelector(sel) : null)
          const results = {}
          const set = async (patch) => { ctx.updateProps(id, patch); await tick(100) }

          await set({ label: '标签X' })
          results.label = (q('.lc-form-item__label')?.textContent || '').trim() === '标签X'

          await set({ required: true })
          results.required = !!q('.lc-form-item__required')

          await set({ labelHidden: true })
          results.labelHidden = !q('.lc-form-item__label')

          await set({ labelHidden: false, labelWidth: 140 })
          const lb = q('.lc-form-item__label')
          results.labelWidth = !!lb && Math.abs(lb.getBoundingClientRect().width - 140) <= 2

          // ⚠️ 原来这里验的是 columnWidth，实测**在参考里也只对子表单字段生效**
          //    （只有 sub-form-item.vue 用了 subWidget.options.columnWidth），
          //    普通字段两边都是无效属性，不适合当断言。换成 size：小尺寸应比默认矮。
          const h0 = q('.el-input') ? Math.round(q('.el-input').getBoundingClientRect().height) : 0
          await set({ size: 'small' })
          const h1 = q('.el-input') ? Math.round(q('.el-input').getBoundingClientRect().height) : 0
          results.size = h0 > 0 && h1 > 0 && h1 < h0

          await set({ maxLength: 5 })
          results.maxLength = String(q('.el-input__inner')?.getAttribute('maxlength')) === '5'

          await set({ placeholder: '占位X' })
          results.placeholder = q('.el-input__inner')?.getAttribute('placeholder') === '占位X'

          await set({ disabled: true })
          results.disabled = q('.el-input__inner')?.disabled === true

          await set({ readonly: true })
          results.readonly = q('.el-input__inner')?.readOnly === true

          // ⚠️ hidden 是**节点级系统属性**（node.meta.hidden），不走 updateProps，
          //    要用 runtime 的 setNodeHidden。走错通道会得到"有变化"的假阳性。
          __unref(ctx.runtime).setNodeHidden(id, true)
          await tick(120)
          const node = root()
          // ⚠️ 渲染层用的是 v-if，隐藏时节点**直接从 DOM 移除**（不是 display:none）。
          //    第一版按 display:none 断言，于是把"已正确隐藏"误报成失败。
          results.hidden = !node || getComputedStyle(node).display === 'none'

          const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k)
          ctx.removeNode(id)
          return { ok: failed.length === 0, detail: { 失败项: failed, 全部: results } }
        })()`,
      },
    ],
  },

  {
    name: 'tab-default-active',
    why: '新建标签页后**没有任何面板被激活**（全部 aria-hidden / display:none）：Tab 的 active 是空串、面板 name 由 EP 自动生成，两边永远对不上。表现是内容区为空。这是一条行为断言，只有真机能看到',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['tab']) },
      { wait: 500 },
      {
        label: '第一个面板默认处于激活状态',
        check: `(() => {
          const panes = [...document.querySelectorAll('.lc-canvas .el-tab-pane')]
          const items = [...document.querySelectorAll('.lc-canvas .el-tabs__item')]
          const active = panes.filter((p) => p.getAttribute('aria-hidden') !== 'true')
          return {
            ok: panes.length > 0 && active.length === 1 && items.some((i) => i.classList.contains('is-active')),
            detail: {
              面板数: panes.length,
              激活面板数: active.length,
              面板可见: panes.map((p) => getComputedStyle(p).display),
              标签激活: items.map((i) => i.classList.contains('is-active')),
            },
          }
        })()`,
      },
      {
        label: '激活面板的内容区有高度（内容区不再是空的）',
        check: `(() => {
          const p = document.querySelector('.lc-canvas .el-tab-pane')
          const h = p ? Math.round(p.getBoundingClientRect().height) : 0
          return { ok: h > 0, detail: { 面板高: h } }
        })()`,
      },
    ],
  },

  {
    name: 'card-collapse',
    why: '卡片是包 el-card 的容器（对齐参考的扩展示例）。折叠按钮从自绘 <button> 改成 ElIcon + 内联 SVG 后，折叠行为不在原套件的覆盖范围内——补上，避免这类改动落进盲区',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['card']) },
      { wait: 300 },
      {
        label: '渲染成 el-card，带 header 槽与默认标题「card」',
        check: `(() => {
          const card = document.querySelector('.lc-canvas .el-card')
          const header = document.querySelector('.lc-canvas .el-card__header')
          const title = document.querySelector('.lc-canvas .lc-card__title')
          const fold = document.querySelector('.lc-canvas .lc-card__fold')
          return {
            ok: !!card && !!header && !!title && !!fold && title.textContent === 'card',
            detail: { card: !!card, header: !!header, 标题: title ? title.textContent : null, 折叠按钮: !!fold },
          }
        })()`,
      },
      {
        label: '折叠前 body 可见',
        check: `(() => {
          const body = document.querySelector('.lc-canvas .lc-card__body')
          return { ok: !!body && getComputedStyle(body).display !== 'none', detail: { body: !!body } }
        })()`,
      },
      { click: '.lc-canvas .lc-card__fold' },
      { wait: 400 },
      {
        label: '点击折叠后 body 隐藏，且图标切换',
        check: `(() => {
          const body = document.querySelector('.lc-canvas .lc-card__body')
          const fold = document.querySelector('.lc-canvas .lc-card__fold')
          const d = fold ? fold.querySelector('path').getAttribute('d') : ''
          const hidden = !!body && getComputedStyle(body).display === 'none'
          // 折叠后应换成"向下"的 chevron（M512 704…），折叠前是向上的（M512 320…）
          const flipped = d.includes('704')
          return { ok: hidden && flipped, detail: { body隐藏: hidden, 图标: d.slice(0, 16) } }
        })()`,
      },
    ],
  },

  {
    name: 'cross-container-drag',
    why: '跨容器拖拽同时涉及索引空间与 beforeId 两条路径',
    steps: [
      { eval: GETCTX_EVAL() },
      { eval: insertMaterials(['input', 'card']) },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const [inputId, cardId] = window.__ids
          ctx.selectNode(inputId)
          await new Promise((r) => setTimeout(r, 500))
          const h = document.querySelector('[data-node-id="' + inputId + '"] .lc-node__badges')
          if (!h) return 'NO_HANDLE'
          h.id = 'node-handle'
          const r = document.querySelector('[data-node-id="' + cardId + '"]').getBoundingClientRect()
          window.__drop = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
          return 'ok'
        })()`,
      },
      { drag: { from: '#node-handle', toExpr: 'window.__drop', steps: 16 } },
      { wait: 500 },
      {
        label: '根层节点拖进卡片 → 成为卡片的子节点',
        check: `(() => {
          ${GETCTX}
          const nodes = __unref(__getCtx().schema).nodes
          const [inputId, cardId] = window.__ids
          const kids = nodes.find((n) => n.id === cardId)?.children ?? []
          return { ok: kids.includes(inputId), detail: { cardChildren: kids, want: inputId } }
        })()`,
      },
    ],
  },
]

// 上面用到的两个小工具（放在 CHECKS 之后定义会被提升，这里用函数声明以便阅读顺序）
function GETCTX_EVAL() {
  return GETCTX
}

/**
 * 按面板文案找到物料项并打标记。
 *
 * ⚠️ 文案与参考实现对齐后（「输入框」→「单行输入」）这里会失效——
 * 面板改名时记得同步本文件。测试 `palette-alignment` 与 `palette.test.ts` 会先报出改名。
 */
function tagMaterial(nameFragment) {
  return `(() => {
    const it = [...document.querySelectorAll('.lc-material-item')].find((e) => e.textContent.includes('${nameFragment}'))
    if (!it) return 'NO_MATERIAL'
    it.id = 'drag-source'
    return 'ok'
  })()`
}

async function detectUrl(explicit) {
  if (explicit) return explicit
  const reachable = []
  for (const port of [5173, 5174, 5175]) {
    for (const host of ['localhost', '[::1]']) {
      const url = `http://${host}:${port}/`
      try {
        const res = await fetch(url)
        if (res.ok) {
          reachable.push(url)
          break
        }
      } catch {
        // 继续尝试
      }
    }
  }
  if (reachable.length > 1) {
    // ⚠️ 不猜。多个端口都可达时，猜错会**拿旧代码当验收对象**——
    // 那比报错危险得多：断言失败会被误读成"代码坏了"，或断言通过被误读成"没问题"。
    console.error('❌ 检测到多个可用的 dev server：')
    for (const u of reachable) console.error(`   - ${u}`)
    console.error('   请用 --url 明确指定要验收哪一个（通常是刚启动的那个）。')
    return '__AMBIGUOUS__'
  }
  return reachable[0] ?? null
}

function runInspect(url, steps) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [INSPECT, '--url', url, '--steps', JSON.stringify(steps), '--json'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('close', (code) => {
      const line = out.split('\n').reverse().find((l) => l.startsWith('__RESULT__ '))
      let result = null
      if (line) {
        try { result = JSON.parse(line.slice('__RESULT__ '.length)) } catch { result = null }
      }
      resolve({ code, result, stdout: out, stderr: err })
    })
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const urlArg = argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : undefined
  const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined

  const url = await detectUrl(urlArg)
  if (!url || url === '__AMBIGUOUS__') {
    if (!url) {
      console.error('❌ 找不到可用的 dev server。请先在另一个终端跑 `pnpm dev`，或用 --url 指定。')
    }
    process.exit(1)
  }
  console.log(`目标：${url}\n`)

  const selected = onlyArg ? CHECKS.filter((c) => c.name.includes(onlyArg)) : CHECKS
  if (selected.length === 0) {
    console.error(`没有匹配 --only "${onlyArg}" 的检查`)
    process.exit(1)
  }

  let failed = 0
  const lines = []
  for (const [index, check] of selected.entries()) {
    process.stdout.write(`[${index + 1}/${selected.length}] ${check.name} … `)
    const { code, result, stderr } = await runInspect(url, check.steps)
    if (!result) {
      console.log('❌ 未取到结果')
      console.error(`    ${stderr.split('\n').filter(Boolean).slice(-3).join('\n    ')}`)
      failed += 1
      lines.push({ name: check.name, ok: false, detail: 'no result' })
      continue
    }
    const bad = result.checks.filter((c) => !c.ok)
    const ok = code === 0 && bad.length === 0
    console.log(ok ? `✅ ${result.checks.length} 项断言` : `❌ ${bad.length}/${result.checks.length} 项断言失败`)
    for (const b of bad) {
      console.log(`    ✗ ${b.label} → ${JSON.stringify(b.detail)}`)
    }
    if (!ok) failed += 1
    lines.push({ name: check.name, ok, checks: result.checks })
    await sleep(200)
  }

  console.log(`\n${'─'.repeat(60)}`)
  for (const l of lines) console.log(`${l.ok ? '✅' : '❌'} ${l.name}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(failed === 0 ? `全部通过（${selected.length} 个检查）` : `${failed}/${selected.length} 个检查失败`)
  process.exit(failed === 0 ? 0 : 2)
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`)
  process.exit(1)
})
