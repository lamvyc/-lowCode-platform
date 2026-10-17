#!/usr/bin/env python3
"""属性 → 渲染 的效果扫描（P0）。

**要解决的问题**：属性面板上改了设置，画布有没有跟着变？

这是本项目最危险的一类 bug——单选项的 `displayStyle` 曾经「写了但画布不响应」，
而当时静态审计 28/28 全绿、画布 A/B 也看不出来（A/B 只对比默认状态）。

**做法**：对每个物料的每个可设属性，取一次 DOM 指纹 → 设值 → 再取指纹，
比较是否变化。变了说明"连线通"；没变就进人工判定清单（分"本该变"和"本来就没视觉影响"）。

指纹 = 该节点子树的 `outerHTML` + 外框尺寸。选它是因为它同时覆盖
类名、内联样式、文本、后代结构的变化。

用法：
    python3 scripts/props-effect.py            # 全量扫描
    python3 scripts/props-effect.py input      # 只扫指定物料
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = Path('/Users/unravel/ lowCode-platform')
URL = 'http://localhost:5174/'

# 已人工判定过的"未被下闸却无反应"数量。见 docs/props-effect.md 的分类表。
BASELINE_SUSPICIOUS = 33
# 仓库路径含前导空格，URL 里要编码
MOD = '/@fs' + str(REPO).replace(' ', '%20') + '/packages/materials/src/manifest.ts'

PAGE = r'''
(async () => {
  const __unref = (v) => (v && typeof v === 'object' && v.__v_isRef ? v.value : v)
  const __getCtx = () => {
    const app = document.querySelector('#app').__vue_app__
    const seen = new Set(); let result = null
    const visit = (vnode, d) => {
      if (!vnode || d > 60) return
      if (vnode.component) walk(vnode.component, d + 1)
      if (Array.isArray(vnode.children)) vnode.children.forEach((k) => visit(k, d + 1))
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
  const ctx = __getCtx()
  const tick = (ms) => new Promise((r) => setTimeout(r, ms))
  const mod = await import(MODULE_PATH)
  const list = mod.MATERIAL_MANIFESTS.filter((m) => !m.hidden && !m.internal)
  const ONLY = ONLY_TYPES

  const nodeEl = (id) => document.querySelector(`[data-node-id="${id}"]`)
  /**
   * ⚠️ 只比 `outerHTML` 会漏掉一半的连线：`<input>` 的当前值、`checked` 这些
   * 是 **property 不是 attribute**，改了 `outerHTML` 一个字符都不变。
   * 第一版就因此把 `modelValue` 误判成"没反应"。
   */
  const fingerprint = (id) => {
    const el = nodeEl(id)
    if (!el) return 'ABSENT'
    const r = el.getBoundingClientRect()
    const live = [...el.querySelectorAll('input, textarea, select')]
      .map((i) => `${i.value}|${i.checked}|${i.disabled}|${i.readOnly}`).join('~')
    return el.outerHTML + '|' + live + '|' + Math.round(r.width) + 'x' + Math.round(r.height)
  }

  // 这些控件不是"给个值"就能验的（结构化编辑器 / 系统项）
  const SKIP_CONTROLS = new Set(['structure', 'name'])

  /**
   * 有些属性要求**特定格式**的值，给个占位字符串等于没设：
   * `columnWidth: 'EFFECT'` 是非法 CSS 宽度，浏览器直接忽略，
   * 于是被误判成"这个属性没接线"（第一版就误判了 columnWidth）。
   */
  const VALUE_OVERRIDES = {
    columnWidth: '300px',
    labelWidth: 120,
    width: '300px',
    cardWidth: '300px',
    gutter: 20,   // ⚠️ 不能等于默认值（默认就是 12，改成 12 等于没改）
    switchWidth: 60,
  }

  /**
   * `modelValue` 必须按物料给**合法值**：给通用字符串 'EFFECT' 时，
   * 日期/时间/单选都渲染不出任何东西，会被误判成"默认值属性没接线"。
   */
  const MODEL_VALUE_BY_TYPE = {
    input: 'EFFECT', textarea: 'EFFECT',
    number: 7, slider: 60, rate: 3,
    date: '2024-01-15', 'date-range': ['2024-01-15', '2024-01-20'],
    time: '12:00:00', 'time-range': ['12:00:00', '13:00:00'],
    select: 1, checkbox: [1],
    'rich-editor': '<p>abc</p>',
  }

  const testValue = (cfg, cur, material, node) => {
    if (cfg.name === 'modelValue') {
      const v = MODEL_VALUE_BY_TYPE[material.type]
      if (v !== undefined) return v
      // 单选：取第一个选项的值，随便给个字符串匹配不上任何选项
      const first = (node.props?.optionItems ?? [])[0]
      if (first) return first.value
      return undefined
    }
    // ⚠️ 只在**类型匹配**时才套 override：`width` 在卡片上是 CSS 字符串（'100%'），
    // 在图片物料上是数字（200px 像素值）。无条件套 '300px' 会让图片的 width
    // 变成 `300pxpx`（非法），于是被误判成"没接线"。
    if (cfg.name in VALUE_OVERRIDES && typeof VALUE_OVERRIDES[cfg.name] === typeof cur) {
      return VALUE_OVERRIDES[cfg.name]
    }
    // 通用规则：当前值是"带单位的长度"（13px / 100%）时，按同单位换个数字。
    // 否则给 'EFFECT' 会变成非法 CSS（如 `font-size: EFFECT`），浏览器直接忽略，
    // 于是被误判成"这个属性没接线"——columnWidth / fontSize 都栽在这上面。
    if (typeof cur === 'string') {
      const m = cur.match(/^(\d+(?:\.\d+)?)(px|%|em|rem)$/)
      if (m) return String(Number(m[1]) + 20) + m[2]
    }
    switch (cfg.control) {
      case 'switch': return !cur
      case 'select':
      case 'radio-button':
      case 'radio': {
        const opts = cfg.options ?? []
        const pick = opts.find((o) => o.value !== cur)
        return pick ? pick.value : undefined
      }
      case 'input': case 'textarea': return 'EFFECT'
      case 'number': return typeof cur === 'number' ? cur + 7 : 7
      case 'label': return 'EFFECT_LABEL'
      case 'color': return '#ff0000'
      case 'slider': return typeof cur === 'number' ? Math.min(cur + 20, 100) : 60
      case 'style': return 'outline: 2px solid red'
      case 'custom-class': return 'effect-probe'
      case 'hidden': return true
      default: return undefined
    }
  }

  /**
   * 前置条件：有些属性**只有在前置状态下才有视觉表现**，直接设它等于什么都没发生。
   * 例：`clearable` 要选了值才出现清除图标；`format` 要有值才有可格式化的文本。
   *
   * 键是 `物料.属性`。值为在**取第一次指纹之前**要打的补丁。
   * ⚠️ 这不算"作弊"：它模拟的是用户真实的操作顺序（先选值再调清除样式）。
   */
  const PREREQ = {
    'select.clearable': { modelValue: 1 },
    'select.multiple': { modelValue: [1] },
    'select.allowCreate': { filterable: true, modelValue: 1 },
    'select.automaticDropdown': { filterable: true },

    'time.clearable': { modelValue: '12:00:00' },
    'time.format': { modelValue: '12:00:00' },
    'time.readonly': { modelValue: '12:00:00' },
    'time-range.clearable': { modelValue: ['12:00:00', '13:00:00'] },
    'time-range.format': { modelValue: ['12:00:00', '13:00:00'] },
    'time-range.readonly': { modelValue: ['12:00:00', '13:00:00'] },

    'date.clearable': { modelValue: '2024-01-15' },
    'date.format': { modelValue: '2024-01-15' },
    'date.valueFormat': { modelValue: '2024-01-15' },
    'date.readonly': { modelValue: '2024-01-15' },
    'date-range.clearable': { modelValue: ['2024-01-15', '2024-01-20'] },
    'date-range.format': { modelValue: ['2024-01-15', '2024-01-20'] },
    'date-range.valueFormat': { modelValue: ['2024-01-15', '2024-01-20'] },
    'date-range.readonly': { modelValue: ['2024-01-15', '2024-01-20'] },

    'rate.lowThreshold': { modelValue: 3 },
    'rate.highThreshold': { modelValue: 3 },

    'rich-editor.showWordLimit': { maxLength: 10, modelValue: '<p>abc</p>' },
    'rich-editor.maxLength': { showWordLimit: true, modelValue: '<p>abc</p>' },
    'rich-editor.minLength': { showWordLimit: true, modelValue: '<p>abc</p>' },
  }

  const out = []
  for (const material of list) {
    if (ONLY.length && !ONLY.includes(material.type)) continue
    for (const cfg of material.propConfigs ?? []) {
      if (SKIP_CONTROLS.has(cfg.control)) continue
      const beforeIds = new Set([...document.querySelectorAll('.lc-canvas [data-node-id]')].map((e) => e.dataset.nodeId))
      ctx.insertMaterial(material.type)
      // ⚠️ insertMaterial 是同步的，但 DOM 更新在下一个 tick ——
      //    必须等一次再找新节点，否则永远找不到（第一版就栽在这，全是 NO_NODE）。
      await tick(60)
      const id = [...document.querySelectorAll('.lc-canvas [data-node-id]')]
        .map((e) => e.dataset.nodeId).find((x) => !beforeIds.has(x))
      if (!id) { out.push({ material: material.type, prop: cfg.name, control: cfg.control, verdict: 'NO_NODE' }); continue }
      await tick(30)
      const node = __unref(ctx.schema).nodes.find((n) => n.id === id) || {}
      const cur = (node.props ?? {})[cfg.name]
      const value = testValue(cfg, cur, material, node)
      if (value === undefined) {
        out.push({ material: material.type, prop: cfg.name, control: cfg.control, verdict: 'SKIPPED', cur })
        ctx.removeNode(id); continue
      }
      const pre = PREREQ[material.type + '.' + cfg.name]
      if (pre) { ctx.updateProps(id, pre); await tick(70) }
      const before = fingerprint(id)
      ctx.updateProps(id, { [cfg.name]: value })
      await tick(45)
      const after = fingerprint(id)
      out.push({
        material: material.type, prop: cfg.name, control: cfg.control,
        verdict: before !== after ? 'CHANGED' : 'NO_CHANGE',
        // ⚠️ 关键字段：属性面板用 visibleWhen 把次级属性藏在条件下。
        // 被下闸的属性在默认状态下改了当然没反应，**这是设计意图，不是 bug**。
        // 只有"没被下闸却没反应"的才是真候选。
        gated: !!cfg.visibleWhen,
        value, cur: typeof cur === 'number' ? cur : String(cur ?? '').slice(0, 24),
      })
      ctx.removeNode(id)
      await tick(20)
    }
  }
  return JSON.stringify(out)
})()
'''.replace('MODULE_PATH', json.dumps(MOD)).replace(
    'ONLY_TYPES', json.dumps(sys.argv[1:] if len(sys.argv) > 1 else []))


def main():
    steps = [{'eval': PAGE}, {'wait': 200}]
    cmd = ['node', 'scripts/cdp-inspect.mjs', '--url', URL,
           '--width', '1600', '--height', '900', '--wait', '.lc-canvas',
           '--steps', json.dumps(steps, ensure_ascii=False)]
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    data = None
    for line in r.stdout.splitlines():
        s = line.strip()
        if s.startswith('=>'):
            raw = s[3:].strip()
            if raw.startswith('"'):
                try:
                    settled = json.loads(raw)
                    data = json.loads(settled) if isinstance(settled, str) else settled
                except Exception:
                    pass
    if data is None:
        print('取数失败：', (r.stderr or r.stdout).strip()[-300:])
        return 1

    Path('/tmp/lc-probes/props-effect.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

    changed = [d for d in data if d['verdict'] == 'CHANGED']
    no_change = [d for d in data if d['verdict'] == 'NO_CHANGE']
    skipped = [d for d in data if d['verdict'] == 'SKIPPED']
    other = [d for d in data if d['verdict'] not in ('CHANGED', 'NO_CHANGE', 'SKIPPED')]

    print(f'共 {len(data)} 个属性：变了 {len(changed)} / 没变 {len(no_change)} / 跳过 {len(skipped)} / 异常 {len(other)}')
    if other:
        print('\n异常：')
        for d in other:
            print(f"  {d['material']}.{d['prop']} → {d['verdict']}")
    suspicious = [d for d in no_change if not d.get('gated')]
    gated = [d for d in no_change if d.get('gated')]
    print(f'  其中：被 visibleWhen 下闸（预期无反应）{len(gated)} / **未被下闸却无反应 {len(suspicious)}**')
    if suspicious:
        print('\n=== ⚠️ 未被下闸却没有反应 —— 真候选 ===')
        for d in suspicious:
            print(f"  {d['material']:16s} {d['prop']:24s} control={d['control']:12s} 旧值={d['cur']} 新值={str(d['value'])[:20]}")
    if gated:
        print('\n=== 被下闸（预期无反应，仅列出）===')
        for d in gated:
            print(f"  {d['material']:16s} {d['prop']:24s}")

    # 基线守卫：目前已人工判定过的"未被下闸却无反应"有 39 个（都属
    # 「需要值/交互才看得出来」或「上传的服务端参数，设计态无视觉」）。
    # 一旦**变多**，说明某个属性新出现了"改了没反应"——正是本脚本要抓的那类 bug。
    if len(suspicious) > BASELINE_SUSPICIOUS:
        print(f"\n❌ 未被下闸却无反应的属性从基线 {BASELINE_SUSPICIOUS} 涨到了 {len(suspicious)}，"
              f"新增的极可能是「改了没反应」的真 bug。")
        return 1
    print(f"\n✅ 未超出基线（{len(suspicious)} ≤ {BASELINE_SUSPICIOUS}）")
    return 0


if __name__ == '__main__':
    sys.exit(main())
