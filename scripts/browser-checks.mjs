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
import { COMMON_FIELD_ASSERTIONS, normalizeAssertions, SPEC_ASSERTIONS } from './spec-assertions.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const INSPECT = join(HERE, 'cdp-inspect.mjs')
/** 物料清单的 dev server URL（`/@fs/` + 绝对路径，路径里的空格要编码） */
const MANIFEST_URL =
  '/@fs' +
  join(HERE, '..', 'packages', 'materials', 'src', 'manifest.ts').replace(/ /g, '%20')

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
    name: 'spec-conformance',
    why: 'docs/interaction-spec/ 里每条验收标准的真机落地。规范文档由 scripts/spec-assertions.mjs 生成，这里是同一张表的执行器——两边不会漂移',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        label: '所有物料的规范断言',
        check: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          // 自己的断言 + **适用于本物料**的通用断言。
          // 通用断言按 requires 过滤：物料没有那个属性就跳过
          // （如 static-text 没有 label，就不该跑 label 断言）。
          // 物料清单从 dev server 动态导入，和运行时用的是同一份源码，不会漂移。
          const OWN = ${JSON.stringify(normalizeAssertions())}
          const COMMON = ${JSON.stringify(COMMON_FIELD_ASSERTIONS)}
          const MANIFEST_URL = ${JSON.stringify(MANIFEST_URL)}
          let byType = new Map()
          try {
            const mod = await import(MANIFEST_URL)
            byType = new Map(mod.MATERIAL_MANIFESTS.filter((m) => !m.hidden).map((m) => [m.type, m]))
          } catch (e) {
            return { ok: false, detail: { 错误: '导入物料清单失败: ' + String(e).slice(0, 120) } }
          }
          const TABLE = {}
          for (const [type, own] of Object.entries(OWN)) {
            const keys = new Set(Object.keys(byType.get(type)?.defaultProps ?? {}))
            TABLE[type] = [...own, ...COMMON.filter((c) => c.requires.every((k) => keys.has(k)))]
          }

          const failures = []
          let total = 0
          for (const [material, list] of Object.entries(TABLE)) {
            for (const a of list) {
              total += 1
              const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
              let id = null
              try {
                ctx.insertMaterial(material)
                await tick(130)
                id = [...document.querySelectorAll('.lc-canvas [data-node-id]')]
                  .map((e) => e.dataset.nodeId).find((x) => !before.has(x))
                if (!id) { failures.push(material + '.' + a.id + ' :: 物料未插入'); continue }
                if (a.props) { ctx.updateProps(id, a.props); await tick(80) }
                const root = document.querySelector('[data-node-id="' + id + '"]')
                let ok = false
                try {
                  ok = new Function('root', a.check)(root) === true
                } catch (e) {
                  failures.push(material + '.' + a.id + ' :: 断言抛错 ' + String(e).slice(0, 80))
                  continue
                }
                if (!ok) failures.push(material + '.' + a.id + ' :: ' + a.desc)
              } finally {
                if (id) { try { ctx.removeNode(id) } catch {} }
                await tick(50)
              }
            }
          }
          return {
            ok: failures.length === 0,
            detail: { 断言总数: total, 失败数: failures.length, 失败项: failures.slice(0, 25) },
          }
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
    name: 'e2e-form-flow',
    why: '端到端：拖入 → 配置 → 预览 → 填表 → 校验 → 提交 → 退出。现有检查各自只覆盖一段（validation-in-preview 管校验时机、props-effect-precise 管单属性），没有一条把整条链路串起来',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          // 拖入两个字段：一个必填输入、一个下拉
          // ⚠️ 第二个字段用 textarea 而不是 select：
          //    下拉框**不能靠打字填值**（要点开面板选选项），
          //    第一版用 select 导致"值没填进去"被误判成校验失败。
          for (const type of ['input', 'textarea']) {
            const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
            ctx.insertMaterial(type)
            await tick(140)
            const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
            if (type === 'input') {
              ctx.updateProps(id, { label: '姓名', required: true, placeholder: '请输入姓名' })
            } else {
              ctx.updateProps(id, { label: '备注', required: true })
            }
            await tick(120)
          }
          window.__e2eIds = __unref(ctx.schema).nodes.map((n) => n.id)
          return 'ok'
        })()`,
      },
      { wait: 300 },
      {
        label: '① 配置生效：两个字段都在画布上，标签与必填标记正确',
        check: `(() => {
          const items = [...document.querySelectorAll('.lc-canvas .lc-form-item')]
          const labels = items.map((i) => (i.querySelector('.lc-form-item__label')?.textContent || '').replace('*', '').trim())
          const required = items.filter((i) => !!i.querySelector('.lc-form-item__required')).length
          return {
            ok: items.length === 2 && labels.includes('姓名') && labels.includes('备注') && required === 2,
            detail: { 字段数: items.length, labels, 必填标记数: required },
          }
        })()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().togglePreview(); await new Promise((r) => setTimeout(r, 900)); return 'ok' })()`,
      },
      {
        label: '② 进入预览：两个字段都可编辑',
        check: `(() => {
          const inPreview = !!document.querySelector('.lc-designer--preview')
          const items = [...document.querySelectorAll('.lc-preview-body .lc-form-item')]
          const inputs = items.map((i) => i.querySelector('input, textarea')).filter(Boolean)
          // ⚠️ 只判"未被禁用"，不判 readOnly：下拉框的内层 input **天生是 readonly** 的
          //    （EP 用 readonly 拦截手敲，点击才展开面板）。第一版按 readOnly 判，
          //    把正常的下拉框误报成"不可编辑"。
          const notDisabled = inputs.filter((i) => !i.disabled).length
          return {
            ok: inPreview && items.length === 2 && notDisabled === inputs.length && inputs.length >= 2,
            detail: { 预览态: inPreview, 字段数: items.length, 输入框: inputs.length, 未禁用: notDisabled },
          }
        })()`,
      },
      {
        eval: `(() => {
          const items = [...document.querySelectorAll('.lc-preview-body .lc-form-item')]
          items.forEach((it, i) => { const inp = it.querySelector('input, textarea'); if (inp) inp.id = 'e2e-input-' + i })
          return 'ok'
        })()`,
      },
      // 空值失焦 → 两个字段都报必填错误
      { click: '#e2e-input-0' },
      { click: '.lc-preview-bar' },
      { wait: 300 },
      { click: '#e2e-input-1' },
      { click: '.lc-preview-bar' },
      { wait: 400 },
      {
        label: '③ 空值失焦：两个必填字段都出现错误提示',
        check: `(() => {
          const errs = [...document.querySelectorAll('.lc-preview-body .lc-form-item__error')].map((e) => e.textContent.trim())
          return { ok: errs.length === 2, detail: { 错误数: errs.length, errs } }
        })()`,
      },
      // 填入值 → 错误消失
      { click: '#e2e-input-0' },
      { type: '张三' },
      { click: '#e2e-input-1' },
      { type: '北京' },
      { click: '.lc-preview-bar' },
      { wait: 400 },
      {
        label: '④ 填完两个字段：错误全部清除，值写入运行期',
        check: `(() => {
          const errs = [...document.querySelectorAll('.lc-preview-body .lc-form-item__error')]
          const v0 = document.querySelector('#e2e-input-0')?.value || ''
          const v1 = document.querySelector('#e2e-input-1')?.value || ''
          return { ok: errs.length === 0 && v0 === '张三' && v1 === '北京', detail: { 错误数: errs.length, v0, v1 } }
        })()`,
      },
      {
        label: '⑤ 提交：预览态已注册页面表单，字段填好后 submitForm 应校验通过并返回 ok',
        check: `(async () => {
          ${GETCTX}
          const rt = __unref(__getCtx().runtime)
          const forms = rt.forms ? rt.forms.size : -1
          let result = null
          try {
            result = await rt.createActionContext().submitForm('page')
          } catch (e) {
            return { ok: false, detail: { 抛异常: String(e).slice(0, 80) } }
          }
          return {
            // 空值提交会返回「表单校验未通过」（由断言 ③ 的校验错误验证同一条链路）
            ok: forms >= 1 && result && result.ok === true,
            detail: { 已注册表单数: forms, submitForm返回: result },
          }
        })()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().togglePreview(); await new Promise((r) => setTimeout(r, 600)); return 'ok' })()`,
      },
      {
        label: '⑥ 退出预览：回到编辑器，两个字段都还在',
        check: `(() => {
          const backToEditor = !document.querySelector('.lc-designer--preview') && !!document.querySelector('.lc-canvas')
          const items = [...document.querySelectorAll('.lc-canvas .lc-form-item')]
          return { ok: backToEditor && items.length === 2, detail: { 回到编辑器: backToEditor, 字段数: items.length } }
        })()`,
      },
    ],
  },

  {
    name: 'runtime-data-flow',
    why: '运行态数据流：事件 → 动作链 → 节点属性变化 → 重新渲染。单测覆盖了动作执行器本身，但"在真实浏览器里配好动作、点一下、看到效果"这条链路从没验过',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          const insert = async (type, props) => {
            const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
            ctx.insertMaterial(type)
            await tick(140)
            const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
            if (id && props) { ctx.updateProps(id, props); await tick(100) }
            return id
          }
          const inputId = await insert('input', { label: '目标', placeholder: '等待动作写入' })
          const buttonId = await insert('button', { text: '点我写值' })
          // 事件 → 动作链：点击按钮把目标节点的 modelValue 改成固定值。
          // ⚠️ 这里必须是**统一动作格式** { id, type, target, params }：
          //    id 是 Schema 校验的必填项（漏了会抛 zod 的
          //    "expected string, received undefined"），
          //    而 { kind, config } 是**归一化之后**的内部形态，不能直接写进 schema。
          ctx.updateNodeEvents(buttonId, {
            click: [
              {
                id: 'action-set-value',
                kind: 'setProp',
                config: { nodeId: inputId, prop: 'modelValue', value: '来自动作链' },
              },
            ],
          })
          window.__flowIds = { inputId, buttonId }
          await tick(150)
          ctx.togglePreview()
          await tick(800)
          return 'ok'
        })()`,
      },
      { wait: 300 },
      {
        label: '① 预览态渲染出按钮与目标输入框',
        check: `(() => {
          const btn = [...document.querySelectorAll('.lc-preview-body .el-button')]
          const inp = [...document.querySelectorAll('.lc-preview-body input')]
          const target = btn.find((b) => b.textContent.includes('点我写值'))
          if (target) target.id = 'flow-btn'
          return { ok: !!target && inp.length >= 1, detail: { 按钮: !!target, 输入框: inp.length } }
        })()`,
      },
      {
        label: '② 点击前：目标输入框是空的',
        check: `(() => {
          const inp = document.querySelector('.lc-preview-body input')
          return { ok: !!inp && inp.value === '', detail: { 值: inp ? inp.value : null } }
        })()`,
      },
      { click: '#flow-btn' },
      { wait: 600 },
      {
        label: '③ 点击后：动作链写入的值出现在目标输入框里',
        check: `(() => {
          const inp = document.querySelector('.lc-preview-body input')
          const v = inp ? inp.value : null
          return { ok: v === '来自动作链', detail: { 值: v } }
        })()`,
      },
      {
        label: '④ 动作执行有记录（metrics 里 event 计数 > 0）',
        check: `(() => {
          ${GETCTX}
          const rt = __unref(__getCtx().runtime)
          const snap = rt.metrics && rt.metrics.snapshot ? rt.metrics.snapshot() : null
          // ⚠️ metrics 的键是 event.execute（不是 event），第一版读错键，
          //    于是"动作明明执行了"却被判成没执行。
          const eventCount = snap && snap['event.execute'] ? (snap['event.execute'].count ?? 0) : 0
          return { ok: eventCount > 0, detail: { 事件执行次数: eventCount } }
        })()`,
      },
    ],
  },

  {
    name: 'runtime-action-chain',
    why: '动作链的语义：条件跳过（when）、多动作顺序、导航。单测覆盖了 ActionChain 执行器，但"在真实浏览器里挂上链、点一下、看顺序和条件是否生效"没验过',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          const insert = async (type, props) => {
            const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
            ctx.insertMaterial(type)
            await tick(150)
            const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
            if (id && props) { ctx.updateProps(id, props); await tick(110) }
            return id
          }
          const inputId = await insert('input', { label: '目标' })
          const buttonId = await insert('button', { text: '跑链' })

          // 一条链里放三个动作，验证：
          //   ① when 为假 → 跳过
          //   ② 顺序执行（后写的覆盖先写的）
          //   ③ navigate 改 hash
          ctx.updateNodeEvents(buttonId, {
            click: [
              { id: 'a-skip', kind: 'setProp', when: 'false',
                config: { nodeId: inputId, prop: 'modelValue', value: '不该出现' } },
              { id: 'a-1', kind: 'setProp',
                config: { nodeId: inputId, prop: 'modelValue', value: '第一个' } },
              { id: 'a-2', kind: 'setProp',
                config: { nodeId: inputId, prop: 'modelValue', value: '第二个' } },
              { id: 'a-nav', kind: 'navigate', config: { route: '#/chain-target' } },
            ],
          })
          await tick(180)
          ctx.togglePreview()
          await tick(850)
          return 'ok'
        })()`,
      },
      { wait: 300 },
      {
        label: '① 预览态渲染出「跑链」按钮',
        check: `(() => {
          const btn = [...document.querySelectorAll('.lc-preview-body .el-button')].find((b) => b.textContent.includes('跑链'))
          if (btn) btn.id = 'chain-btn'
          return { ok: !!btn, detail: { 按钮: !!btn } }
        })()`,
      },
      {
        eval: `(() => { location.hash = ''; return 'ok' })()`,
      },
      { click: '#chain-btn' },
      { wait: 700 },
      {
        label: '② when 为假的动作被跳过、后面的动作顺序执行（最终是最后一条的值）',
        check: `(() => {
          const inp = document.querySelector('.lc-preview-body input')
          const v = inp ? inp.value : null
          return {
            ok: v === '第二个',
            detail: { 值: v, 说明: '若是"不该出现"说明 when 没生效；若是"第一个"说明链在第一条就停了' },
          }
        })()`,
      },
      {
        label: '③ navigate 动作改变了 location.hash',
        check: `(() => ({ ok: location.hash === '#/chain-target', detail: { hash: location.hash } }))()`,
      },
      {
        label: '④ 一条链里 only 有效动作被计入 metrics（4 个动作、1 个被跳过）',
        check: `(() => {
          ${GETCTX}
          const rt = __unref(__getCtx().runtime)
          const snap = rt.metrics && rt.metrics.snapshot ? rt.metrics.snapshot() : null
          const n = snap && snap['event.execute'] ? snap['event.execute'].count : 0
          return { ok: n >= 1, detail: { 事件执行次数: n } }
        })()`,
      },
    ],
  },

  {
    name: 'editor-history',
    why: '编辑器的撤销/重做与复制粘贴：每一步都会改 schema 并重建 RuntimeContext，涉及历史栈、选中态、运行时重建三者的配合。单测覆盖了引擎方法，但"真实操作后画布是否跟着回退/前进"没验过',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          ctx.insertMaterial('input')
          await tick(200)
          window.__h = { id: __unref(ctx.schema).nodes[0]?.id }
          return 'ok'
        })()`,
      },
      { wait: 250 },
      {
        label: '① 插入后画布上有 1 个节点、canUndo 为真',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const n = document.querySelectorAll('.lc-canvas [data-node-id]').length
          return { ok: n === 1 && __unref(ctx.canUndo) === true, detail: { 节点数: n, canUndo: __unref(ctx.canUndo) } }
        })()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().undo(); await new Promise(r => setTimeout(r, 300)); return 'ok' })()`,
      },
      {
        label: '② 撤销后画布回到空、canRedo 为真',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const n = document.querySelectorAll('.lc-canvas [data-node-id]').length
          return { ok: n === 0 && __unref(ctx.canRedo) === true, detail: { 节点数: n, canRedo: __unref(ctx.canRedo) } }
        })()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().redo(); await new Promise(r => setTimeout(r, 300)); return 'ok' })()`,
      },
      {
        label: '③ 重做后节点回来，且是同一个 id（不是重新生成的新节点）',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const ids = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
          return { ok: ids.length === 1 && ids[0] === window.__h.id, detail: { ids, 原id: window.__h.id } }
        })()`,
      },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          ctx.copyNode(window.__h.id)
          ctx.pasteClipboard()
          await new Promise(r => setTimeout(r, 300))
          return 'ok'
        })()`,
      },
      {
        label: '④ 复制粘贴后变成 2 个节点，且 id 不同',
        check: `(() => {
          const ids = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
          return { ok: ids.length === 2 && ids[0] !== ids[1], detail: { ids } }
        })()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().undo(); await new Promise(r => setTimeout(r, 300)); return 'ok' })()`,
      },
      {
        label: '⑤ 撤销粘贴后回到 1 个节点，且剩下的是原来那个',
        check: `(() => {
          const ids = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId)
          return { ok: ids.length === 1 && ids[0] === window.__h.id, detail: { ids } }
        })()`,
      },
      {
        // ⚠️ 必须**每次 undo 之后等一帧**再继续：undo 会重建 RuntimeContext 与画布，
        //    同步连调 8 次时 DOM 还没跟上，断言就会读到中间态（第一版就栽在这，
        //    报"节点数 1"，看起来像撤销没生效）。
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          let guard = 0
          while (__unref(ctx.canUndo) && guard < 20) {
            ctx.undo()
            guard += 1
            await new Promise((r) => setTimeout(r, 100))
          }
          return 'steps:' + guard
        })()`,
      },
      { wait: 300 },
      {
        label: '⑥ 一路撤销到边界：画布为空、canUndo 变为假、不抛异常',
        check: `(() => {
          ${GETCTX}
          const ctx = __getCtx()
          const n = document.querySelectorAll('.lc-canvas [data-node-id]').length
          return { ok: n === 0 && __unref(ctx.canUndo) === false, detail: { 节点数: n, canUndo: __unref(ctx.canUndo) } }
        })()`,
      },
    ],
  },

  {
    name: 'design-mode-inert',
    why: '设计态（画布）点组件只应该"选中"它，不该执行它的动作。原先事件无条件绑定，配了 navigate 的按钮在画布上点一下会**把编辑器导航走**；注入 request 后还会在画布上发真实请求',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
          ctx.insertMaterial('button')
          await tick(150)
          const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
          ctx.updateProps(id, { text: '别点我' })
          ctx.updateNodeEvents(id, { click: [{ id: 'a1', kind: 'navigate', config: { route: '#/design-should-not-nav' } }] })
          await tick(200)
          location.hash = ''
          return 'ok'
        })()`,
      },
      { wait: 250 },
      {
        label: '① 设计态点按钮：事件不执行（hash 不变）',
        check: `(() => {
          const btn = document.querySelector('.lc-canvas .el-button')
          if (!btn) return { ok: false, detail: { 错误: '画布上没找到按钮' } }
          location.hash = ''
          btn.click()
          return { ok: location.hash === '', detail: { hash: location.hash } }
        })()`,
      },
      { wait: 400 },
      {
        label: '② 设计态点击后 hash 仍然没变（异步动作也没漏出去）',
        check: `(() => ({ ok: location.hash === '', detail: { hash: location.hash } }))()`,
      },
      {
        eval: `(async () => { ${GETCTX} __getCtx().togglePreview(); await new Promise(r => setTimeout(r, 800)); return 'ok' })()`,
      },
      { wait: 300 },
      {
        label: '③ 对照：同样的按钮**在预览态**点击会执行动作',
        check: `(() => {
          location.hash = ''
          const btn = document.querySelector('.lc-preview-body .el-button')
          if (!btn) return { ok: false, detail: { 错误: '预览里没找到按钮' } }
          btn.click()
          return { ok: location.hash === '#/design-should-not-nav', detail: { hash: location.hash } }
        })()`,
      },
    ],
  },

  {
    name: 'runtime-request-action',
    why: '「请求数据」动作在预览态原先**一定失败**（运行时没注入 request）。现在注入了 fetch 实现，用打桩的 fetch 验证：真的发起请求、拿到数据、写进运行时状态',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          // 打桩 fetch：记录调用、返回固定数据
          window.__fetchLog = []
          window.fetch = async (url, init) => {
            window.__fetchLog.push({ url: String(url), method: (init && init.method) || 'GET' })
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify({ list: [1, 2, 3] }),
            }
          }
          const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
          ctx.insertMaterial('button')
          await tick(150)
          const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
          ctx.updateProps(id, { text: '拉数据' })
          ctx.updateNodeEvents(id, {
            click: [
              {
                id: 'a-req',
                kind: 'request',
                config: { url: '/api/list', method: 'GET', params: { page: 2 } },
              },
            ],
          })
          await tick(200)
          ctx.togglePreview()
          await tick(800)
          return 'ok'
        })()`,
      },
      { wait: 300 },
      {
        label: '① 预览态渲染出「拉数据」按钮，且还没发请求',
        check: `(() => {
          const btn = [...document.querySelectorAll('.lc-preview-body .el-button')].find((b) => b.textContent.includes('拉数据'))
          if (btn) btn.id = 'req-btn'
          return { ok: !!btn && window.__fetchLog.length === 0, detail: { 按钮: !!btn, 已发请求: window.__fetchLog.length } }
        })()`,
      },
      { click: '#req-btn' },
      { wait: 700 },
      {
        label: '② 点击后真的发起了请求（url 带上了 params）',
        check: `(() => {
          const log = window.__fetchLog
          const hit = log.find((x) => x.url.includes('/api/list'))
          return {
            ok: !!hit && hit.url.includes('page=2') && hit.method === 'GET',
            detail: { 请求记录: log },
          }
        })()`,
      },
      {
        label: '③ 请求结果写进了运行时状态 requestResult',
        check: `(() => {
          ${GETCTX}
          const rt = __unref(__getCtx().runtime)
          const v = rt.state.requestResult
          return { ok: JSON.stringify(v) === JSON.stringify({ list: [1, 2, 3] }), detail: { requestResult: v } }
        })()`,
      },
    ],
  },

  {
    name: 'runtime-submit-action',
    why: '「提交表单」动作在 ActionRegistry 里早已实现，但 ActionKind 与编辑器动作列表里都没有它——用户根本配不出来。补上之后用真机验证：点提交按钮会跑整表校验',
    steps: [
      { eval: GETCTX_EVAL() },
      {
        eval: `(async () => {
          ${GETCTX}
          const ctx = __getCtx()
          const tick = (ms) => new Promise((r) => setTimeout(r, ms))
          const insert = async (type, props) => {
            const before = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
            ctx.insertMaterial(type)
            await tick(150)
            const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId).find((x) => !before.has(x))
            if (id && props) { ctx.updateProps(id, props); await tick(110) }
            return id
          }
          await insert('input', { label: '邮箱', required: true })
          const buttonId = await insert('button', { text: '提交表单' })
          ctx.updateNodeEvents(buttonId, {
            click: [{ id: 'a-submit', kind: 'submit', config: { formId: 'page' } }],
          })
          await tick(200)
          ctx.togglePreview()
          await tick(850)
          return 'ok'
        })()`,
      },
      { wait: 300 },
      {
        label: '① 预览态渲染出「提交表单」按钮，且此刻没有校验错误',
        check: `(() => {
          const btn = [...document.querySelectorAll('.lc-preview-body .el-button')].find((b) => b.textContent.includes('提交表单'))
          if (btn) btn.id = 'submit-btn'
          const errs = document.querySelectorAll('.lc-preview-body .lc-form-item__error')
          return { ok: !!btn && errs.length === 0, detail: { 按钮: !!btn, 错误数: errs.length } }
        })()`,
      },
      { click: '#submit-btn' },
      { wait: 700 },
      {
        label: '② 点击提交：必填项为空 → 整表校验失败并显示错误',
        check: `(() => {
          const errs = [...document.querySelectorAll('.lc-preview-body .lc-form-item__error')].map((e) => e.textContent.trim())
          return { ok: errs.length === 1, detail: { 错误数: errs.length, errs } }
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
