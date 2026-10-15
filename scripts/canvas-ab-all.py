#!/usr/bin/env python3
"""画布级 A/B（全量）：把每个物料分别放进两个 app 的画布，对比渲染出的控件结构与尺寸。

设计要点（都是为了绕开两边的**不对称**）：

1. **本仓库画布自带 demo schema，参考实现启动时是空的。**
   所以本仓库只素描"新插入的那个节点"（插入前后取差集拿到 id），
   参考实现直接素描 `.widget-form`。

2. **包裹层类名不同**（我们 `lc-form-item` / 参考 `el-form-item`）。
   因此**只对比实际控件**（`el-*` 元素）的结构与尺寸；
   包裹层（form-item）的盒子尺寸单独对比，不与控件混在一起。

3. **两边的拖拽实现不同**（参考 vuedraggable 鼠标事件 / 我们 HTML5 DnD），
   但同一个真实鼠标手势两边都能驱动；物料标签已对齐，同一个 `[title="…"]` 通用。

用法：
    python3 scripts/canvas-ab-all.py              # 全部物料
    python3 scripts/canvas-ab-all.py 单行输入 单选项  # 只跑指定物料
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = Path('/Users/unravel/ lowCode-platform')
REF = {'url': 'http://localhost:8090/', 'wait': '#app', 'form': "document.querySelector('.widget-form')", 'item': '.el-form-item'}
OURS = {'url': 'http://localhost:5174/', 'wait': '.lc-canvas', 'form': "document.querySelector('.lc-runtime-root')", 'item': '.lc-form-item'}

# 面板标签（两边一致），与 docs/palette-diff.md 的清单对应
ALL_MATERIALS = [
    '栅格', '表格', '标签页', '卡片',
    '单行输入', '多行输入', '计数器', '单选项', '多选项', '下拉选项',
    '时间', '时间范围', '日期', '日期范围', '开关', '评分',
    '颜色选择器', '滑块', '静态文字', 'HTML', '按钮', '分隔线', '图片',
    # ⚠️ 「图片上传」的标签与「图片」（展示）重名，[title="图片"] 只能命中后者；
    # 上传类物料需要更精确的定位（按 manifest type），暂不在本轮范围。
    '文件', '富文本', '级联选择', '提示',
]

# 素描：控件的结构 + 尺寸 + 关键计算样式
SKETCH = r'''(() => {
  const root = %s
  if (!root) return JSON.stringify({ error: 'no root' })
  const box = (el) => {
    const b = el.getBoundingClientRect()
    const c = getComputedStyle(el)
    return {
      w: Math.round(b.width), h: Math.round(b.height),
      display: c.display, height: c.height, fontSize: c.fontSize,
      padding: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(' '),
      margin: [c.marginTop, c.marginRight, c.marginBottom, c.marginLeft].join(' '),
      borderRadius: c.borderRadius,
    }
  }
  const controls = []
  const visit = (el, depth) => {
    if (depth > 8) return
    for (const c of el.children) {
      const cls = String(c.className || '')
      // ⚠️ 必须取**完整**类名：用 /el-[a-z0-9-]+/ 会把 BEM 的 __ 后缀截掉，
      // el-form-item__content / el-input__wrapper / el-input__inner 会一起塌缩成块名，
      // 导致控件序列整体错位、数量对不上（第一版就踩了）。
      //
      // 另外我们的"表单项外壳"用自己的 lc- 类（参考是 el-），
      // 若不映射，参考的序列会多出 label/content 两项而我们的没有 → 又错位。
      const ALIAS = {
        'lc-form-item': 'el-form-item',
        'lc-form-item__label': 'el-form-item__label',
        'lc-form-item__control': 'el-form-item__content',
        'lc-form-item__error': 'el-form-item__error',
        'lc-form-item__required': 'el-form-item__required',
      }
      const names = String(cls || '').split(/\s+/)
        .filter((c) => c.startsWith('el-') || c.startsWith('lc-'))
        // 排除编辑器自身的画布浮层（操作条 / 拖拽手柄 / 徽标），它们不属于物料渲染结果。
        // 不排除的话，容器类物料的素描里会混进 lc-node__badges / lc-node__action 这些，
        // 造成"控件数 3 vs 10"这类假差异。
        .filter((c) => !c.startsWith('lc-node'))
        .map((c) => ALIAS[c] || c)
      const b = c.getBoundingClientRect()
      if (names.length && (b.width > 0 || b.height > 0)) {
        controls.push({ el: names.join('.'), depth, ...box(c) })
      }
      visit(c, depth + 1)
    }
  }
  visit(root, 0)
  return JSON.stringify({ item: box(root), controls })
})()'''


def ev(app, steps):
    cmd = ['node', 'scripts/cdp-inspect.mjs', '--url', app['url'],
           '--width', '1600', '--height', '900', '--wait', app['wait'],
           '--steps', json.dumps(steps, ensure_ascii=False)]
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    found = None
    for line in r.stdout.splitlines():
        s = line.strip()
        if s.startswith('=>'):
            raw = s[3:].strip()
            if raw.startswith('"'):
                try:
                    found = json.loads(json.loads(raw))
                except Exception:
                    pass
    if found is None:
        print(f'    ⚠️ 取数失败: {(r.stderr or r.stdout).strip()[-200:]}')
    return found


def insert_and_sketch(app, is_ref, label):
    """拖入物料并素描；本仓库只素描新插入的节点。"""
    # ⚠️ 两边必须从**同一层级**开始素描。
    # 参考的 `.el-form-item` 自带 el- 类，而我们的是 `.lc-form-item`（无 el- 类），
    # 若以容器为根，参考的序列会多出 form-item 这一项而我们的不会 → 整体错位一位，
    # 后面所有对比都在比不同的元素（第一版就踩了这个坑）。
    if is_ref:
        sketch_root = "(document.querySelector('.widget-form .el-form-item') || " + app['form'] + ")"
    else:
        # 用 find 按 dataset 匹配，避免拼接选择器字符串
        # （拼接版本在运行时抛 "not a valid selector"：属性值里带下划线并非问题，
        #   真因是 `window.__newId` 在拼接那一刻还是 undefined 时字符串落成
        #   `[data-node-id="undefined"] ...` 本应合法——所以改走 find，彻底不依赖拼接）
        sketch_root = ("(() => { const w = [...document.querySelectorAll('.lc-canvas [data-node-id]')]"
                       ".find((e) => e.dataset.nodeId === window.__newId);"
                       " return w ? (w.querySelector('.lc-form-item') || w) : null })()")
    steps = [
        {'eval': f"(() => {{ const f = {app['form']}; const b = f.getBoundingClientRect();"
                 f" window.__drop = {{ x: Math.round(b.left + 120), y: Math.round(b.top + 60) }};"
                 f" window.__beforeIds = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map(e => e.dataset.nodeId);"
                 f" return 'ok' }})()"},
        {'drag': {'from': f'[title="{label}"]', 'toExpr': 'window.__drop', 'steps': 20}},
        {'wait': 1100},
    ]
    if not is_ref:
        steps.append({'eval': "(() => { const ids = [...document.querySelectorAll('.lc-canvas [data-node-id]')].map(e => e.dataset.nodeId);"
                              " window.__newId = ids.find(i => !window.__beforeIds.includes(i)); return window.__newId || 'NONE' })()"})
    steps.append({'assert': SKETCH % sketch_root})
    return ev(app, steps)


def diff_controls(ref, ours):
    """对比控件序列：逐位比 el 名与宽高；数量不同也报出来。"""
    issues = []
    rc, oc = ref.get('controls', []), ours.get('controls', [])
    if [c['el'] for c in rc] != [c['el'] for c in oc]:
        issues.append(('控件结构', ' → '.join(c['el'] for c in rc)[:150], ' → '.join(c['el'] for c in oc)[:150]))
    for i in range(min(len(rc), len(oc))):
        a, b = rc[i], oc[i]
        if a['el'] != b['el']:
            continue
        for k in ('w', 'h', 'display', 'height', 'fontSize', 'borderRadius'):
            if a[k] != b[k]:
                issues.append((f'{a["el"]}.{k}', a[k], b[k]))
        for k in ('padding', 'margin'):
            if a[k] != b[k]:
                issues.append((f'{a["el"]}.{k}', a[k], b[k]))
    ri, oi = ref.get('item'), ours.get('item')
    if ri and oi:
        if ri['w'] != oi['w']:
            issues.append(('form-item.w', ri['w'], oi['w']))
        if ri['margin'] != oi['margin']:
            issues.append(('form-item.margin', ri['margin'], oi['margin']))
    return issues


def main():
    materials = sys.argv[1:] or ALL_MATERIALS
    summary = []
    for label in materials:
        ref = insert_and_sketch(REF, True, label)
        ours = insert_and_sketch(OURS, False, label)
        if not ref or not ours:
            print(f'{label:8s} ⚠️ 取数失败'); summary.append((label, -1, [])); continue
        if ref.get('error') or ours.get('error'):
            print(f'{label:8s} ⚠️ 画布为空（拖拽未生效）'); summary.append((label, -1, [])); continue
        issues = diff_controls(ref, ours)
        rc = len(ref.get('controls', [])); oc = len(ours.get('controls', []))
        if not issues:
            print(f'{label:8s} ✅ 一致（控件 {rc} 个）')
        else:
            print(f'{label:8s} ❌ {len(issues)} 处差异（控件 {rc} vs {oc}）')
            for name, a, b in issues[:8]:
                print(f'          {name:26s} 参考={str(a)[:38]:<38} 我们={str(b)[:38]}')
        summary.append((label, len(issues), issues))

    print('\n' + '=' * 74)
    ok = [s for s in summary if s[1] == 0]
    bad = [s for s in summary if s[1] > 0]
    fail = [s for s in summary if s[1] < 0]
    print(f'完全一致 {len(ok)} / 有差异 {len(bad)} / 未取到 {len(fail)}   （共 {len(summary)} 个物料）')
    if bad:
        print('\n差异数排序：')
        for label, n, _ in sorted(bad, key=lambda x: -x[1]):
            print(f'  {n:3d}  {label}')
    if fail:
        print('未取到：', ' '.join(l for l, _, _ in fail))
    Path('/tmp/lc-probes/ab-all.json').write_text(
        json.dumps([{'label': l, 'issues': n, 'detail': [[a, str(b), str(c)] for a, b, c in d]} for l, n, d in summary],
                   ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n明细已写入 /tmp/lc-probes/ab-all.json')


if __name__ == '__main__':
    main()
