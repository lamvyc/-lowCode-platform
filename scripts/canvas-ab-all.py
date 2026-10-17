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
REF = {'url': 'http://localhost:8090/', 'wait': '#app', 'form': "document.querySelector('.widget-form')",
       'item': '.el-form-item', 'wrap': "document.querySelector('.widget-form .field-wrapper')"
              " || document.querySelector('.widget-form .container-wrapper')"}
OURS = {'url': 'http://localhost:5174/', 'wait': '.lc-canvas', 'form': "document.querySelector('.lc-runtime-root')",
        'item': '.lc-form-item',
        'wrap': "[...document.querySelectorAll('.lc-canvas [data-node-id]')].find((e) => e.dataset.nodeId === window.__newId)"}

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
  // 编辑器自身的浮层：整棵子树都要跳过。
  // 参考：.field-action（字段操作条）/ .container-action（**容器**操作条）/ .drag-handler（拖拽手柄）
  // 我们：.lc-node__badges / .lc-node__actions
  // ⚠️ 只过滤元素自身不够——里面的 el-icon-* 会漏进来，让容器类物料的
  //    "控件结构" 看起来差很多（表格/卡片曾报成 el-icon-back/copy-document/delete…）。
  // ⚠️ 容器用的是 **container-action**，与字段的 field-action 不是一个类名，
  //    第一版只过滤了后者，于是容器类物料的差异全是编辑器浮层造成的假象。
  const CHROME = /(^|\s)(lc-node__badges|lc-node__actions|field-action|container-action|drag-handler)(\s|$)/
  const visit = (el, depth) => {
    if (depth > 8) return
    for (const c of el.children) {
      if (CHROME.test(String(c.className || ''))) continue
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
      // 只保留 el-*（Element 的类），外加**明确登记过的别名**。
      // ⚠️ 不能把所有 lc-* 都收进来：那是本仓库自己的根类（lc-card / lc-static-text …），
      //    参考没有对应物，会把"我们的组件多了个根类"报成结构差异。
      //    静态文字因此曾报成「控件 0 vs 1」——参考那个组件是纯 div，压根没有 el- 元素。
      const names = String(cls || '').split(/\s+/)
        .map((c) => ALIAS[c] || c)
        .filter((c) => c.startsWith('el-'))
      const b = c.getBoundingClientRect()
      if (names.length && (b.width > 0 || b.height > 0)) {
        controls.push({ el: names.join('.'), depth, ...box(c) })
      }
      visit(c, depth + 1)
    }
  }
  // 控件序列从"表单项"这一级往下（两边同级，序列才对得上）；
  // item 盒子按**节点包裹层**测——参考的 .el-form-item 比它的包裹层还窄 6px
  // （margin/padding/border 全为 0，机制未定论），在表单项这一级比较会混进那 6px。
  const controlsRoot = root.querySelector('%s') || root
  visit(controlsRoot, 0)
  const wrap = %s
  return JSON.stringify({ item: box(wrap || root), controls })
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
    steps.append({'assert': SKETCH % (sketch_root, app['item'], app['wrap'])})
    return ev(app, steps)


# 已知的**机制差异**：两边实现手法不同、但渲染效果等价，不该计入"差异"。
# 单列出来（而不是静默丢弃），这样报告仍然看得见，只是不污染计数。
KNOWN_MECHANISM = {
    # EU：label 浮动 + content 用 margin-left 让出宽度；我们：flex 布局。
    # 参考 content.margin = 0 0 0 80px，我们 = 0，但两者的 content 左边界一致。
    ('el-form-item__content', 'margin'),
}


def diff_controls(ref, ours):
    """对比控件序列：逐位比 el 名与宽高；数量不同也报出来。"""
    issues = []
    mechanisms = []
    rc, oc = ref.get('controls', []), ours.get('controls', [])
    # 结构比较前先把"上游档位类"剔掉，否则 el-range-editor--medium 这类差异
    # 会把整条结构序列判为不同（而它已在下面按"已知差异"处理）。
    def shape(controls):
        """结构键：**与类名顺序、修饰类无关**。

        ⚠️ 早先直接拼整串类名，于是同一元素只要类名顺序不同、或 EP 多/少一个
        档位类（el-input--medium）就会被判成"结构不同"——23 个物料里绝大多数
        属于这种假象，真结构差异被淹没。
        取"去掉修饰类后的类集合（排序）"作为键。
        """
        import re as _re
        # 值为 0 的布局辅助类等价于"没有该规则"：Element Plus 去掉了
        # `el-col-offset-0 / el-col-pull-0 / el-col-push-0`，Element UI 还留着。
        # 不归一掉的话，栅格这类物料的"结构差异"全是这个造成的假象。
        noop = _re.compile(r'^el-col-(offset|pull|push)-0$')
        out = []
        for c in controls:
            parts = sorted({t for t in c['el'].split('.') if '--' not in t and not noop.match(t)})
            out.append('|'.join(parts))
        return out

    if shape(rc) != shape(oc):
        issues.append(('控件结构', ' → '.join(c['el'] for c in rc)[:150], ' → '.join(c['el'] for c in oc)[:150]))
    def block_of(el):
        """取块名（第一个 el- 类）：el-button--primary → el-button"""
        return el.split('.')[0]

    for i in range(min(len(rc), len(oc))):
        a, b = rc[i], oc[i]
        # ⚠️ 这里曾经是 `if a['el'] != b['el']: continue` —— 只要类名不完全相同就
        # **跳过该元素的全部属性比较**。于是当我们的元素多了个 lc-* 修饰类时
        # （如 el-divider--horizontal.lc-divider），它的 margin/height 等差异
        # 被静默吞掉，报告显示"没问题"。
        # 修法：只在**块名**都不同时才认为不是同一元素而跳过；
        # 仅修饰类不同时，照常比较属性，并把修饰类差异单独报出来。
        if block_of(a['el']) != block_of(b['el']):
            continue
        if a['el'] != b['el']:
            # 上游档位类差异不算渲染偏差：Element UI 有 medium/small/mini 三档类，
            # Element Plus 只有 large/default/small。我们用 CSS 变量模拟 medium 的度量
            # （--el-component-size / --el-input-height），因此不会出现 `--medium` 类，
            # 但**尺寸是对的**。属上游 API 差异。
            only_stage_classes = (
                {t for t in a['el'].split('.') if '--' in t} - {t for t in b['el'].split('.') if '--' in t}
            ) <= {'el-range-editor--medium', 'el-input--medium', 'el-cascader--medium', 'el-form-item--medium',
                  'el-select--medium', 'el-textarea--medium', 'el-input-number--medium', 'el-date-editor--medium'}
            if only_stage_classes:
                mechanisms.append((f'上游档位类 @ {block_of(a["el"])}', a['el'], b['el']))
            else:
                issues.append((f'修饰类 @ {block_of(a["el"])}', a['el'], b['el']))
        for k in ('w', 'h', 'display', 'height', 'fontSize', 'borderRadius'):
            if a[k] != b[k]:
                issues.append((f'{a["el"]}.{k}', a[k], b[k]))
        for k in ('padding', 'margin'):
            if a[k] != b[k]:
                target = mechanisms if (a['el'], k) in KNOWN_MECHANISM else issues
                target.append((f'{a["el"]}.{k}', a[k], b[k]))
    ri, oi = ref.get('item'), ours.get('item')
    if ri and oi:
        if ri['w'] != oi['w']:
            issues.append(('form-item.w', ri['w'], oi['w']))
        # 间距机制不同：参考放在**节点包裹层**（.field-wrapper + design-time-bottom-margin），
        # 我们放在 .lc-form-item。同一件事、不同层，属机制差异。
        if ri['margin'] != oi['margin']:
            mechanisms.append(('节点包裹.margin', ri['margin'], oi['margin']))
    return issues, mechanisms


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
        issues, mechanisms = diff_controls(ref, ours)
        rc = len(ref.get('controls', [])); oc = len(ours.get('controls', []))
        if not issues:
            print(f'{label:8s} ✅ 一致（控件 {rc} 个）')
        else:
            extra = f'，{len(mechanisms)} 处已知机制差异' if mechanisms else ''
            print(f'{label:8s} ❌ {len(issues)} 处差异（控件 {rc} vs {oc}）{extra}')
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
