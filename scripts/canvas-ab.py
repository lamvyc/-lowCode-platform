#!/usr/bin/env python3
"""画布级 A/B：把同一个物料放进两个 app 的画布，测量渲染结果并逐项 diff。

为什么需要它：静态一致性审计查 props/events、上游样式审计查 CSS，
**两者都看不到"画布上真正渲染成什么样"**。而这一层恰恰是"感觉不一样"的来源
——实测一次就查出 `body` 默认 8px 外边距没重置、label 默认堆叠、控件高 32 vs 36 等
一整套系统性问题。

前置：
    参考实现  cd variant-form && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service serve --port 8090
    本仓库    pnpm dev（本项目）

用法：
    python3 scripts/canvas-ab.py

注意：
- 两边都用 1600×900 视口；参考实现用 vuedraggable（鼠标事件），本仓库用 HTML5 DnD，
  同一个真实鼠标手势两边都能驱动。
- 物料标签已与参考对齐，所以**同一个 `[title="…"]` 选择器对两边都有效**。
- ⚠️ 本仓库画布自带 demo schema（参考启动时是空的），因此测量必须取**最后插入**的
  form-item，否则会命中 demo 里已有的节点。
"""
import json
import subprocess
from pathlib import Path

REPO = Path('/Users/unravel/ lowCode-platform')
REF = {'url': 'http://localhost:8090/', 'wait': '#app'}
OURS = {'url': 'http://localhost:5174/', 'wait': '.lc-canvas'}

# 各 app 的画布容器与标签选择器
CANVAS = {
    'ref': {
        'form': "document.querySelector('.widget-form')",
        'label': '.el-form-item__label',
        'input': '.el-input',
        'inputInner': '.el-input__inner',
        'item': '.el-form-item',
    },
    'ours': {
        'form': "document.querySelector('.lc-runtime-root')",
        'label': '.lc-form-item__label',
        'input': '.el-input',
        'inputInner': '.el-input__inner',
        'item': '.lc-form-item',
    },
}


def measure_expr(sel):
    return f'''(() => {{
  const t = (el) => (el && el.textContent ? el.textContent.replace(/\\s+/g, ' ').trim() : null)
  const box = (el) => {{
    if (!el) return null
    const b = el.getBoundingClientRect()
    const c = getComputedStyle(el)
    return {{
      x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
      display: c.display, boxSizing: c.boxSizing,
      fontSize: c.fontSize, lineHeight: c.lineHeight,
      height: c.height, width: c.width,
      padding: c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft,
      margin: c.marginTop + ' ' + c.marginRight + ' ' + c.marginBottom + ' ' + c.marginLeft,
      border: c.borderTopWidth + ' ' + c.borderRightWidth + ' ' + c.borderBottomWidth + ' ' + c.borderLeftWidth,
      borderRadius: c.borderRadius,
      color: c.color,
      backgroundColor: c.backgroundColor,
      verticalAlign: c.verticalAlign,
    }}
  }}
  const form = {sel['form']}
  return JSON.stringify({{
    表单: form ? {{ w: Math.round(form.getBoundingClientRect().width), h: Math.round(form.getBoundingClientRect().height) }} : null,
    条目: box(form && form.querySelector('{sel['item']}')),
    标签: (() => {{ const l = form && form.querySelector('{sel['label']}'); return l ? {{ 文本: t(l), ...box(l) }} : null }})(),
    控件: box(form && form.querySelector('{sel['input']}')),
    原生输入: box(form && form.querySelector('{sel['inputInner']}')),
  }})
}})()'''


def ev(app, expr, steps=None):
    cmd = ['node', 'scripts/cdp-inspect.mjs', '--url', app['url'],
           '--width', '1600', '--height', '900', '--wait', app['wait']]
    if steps is not None:
        cmd += ['--steps', json.dumps(steps, ensure_ascii=False)]
    else:
        cmd += ['--eval', expr]
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
        print(f'  ⚠️ 取数失败: {r.stderr.strip()[:200] or r.stdout.strip()[-300:]}')
    return found


DROP = '''(() => {
  const f = %s
  const b = f.getBoundingClientRect()
  window.__drop = { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + 120) }
  return JSON.stringify({ drop: window.__drop, 画布: { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top) } })
})()'''


def measure_last_expr(sel):
    """只测**最后插入**的那个 form-item。

    ⚠️ 本仓库的画布自带 demo schema（参考实现启动时是空的），
    直接取 form.querySelector 会命中 demo 里已有的节点而不是新插入的——
    第一版就踩了这个坑，测出来的是 demo 的「筛选条件」而不是新节点。
    """
    base = measure_expr(sel)
    return base.replace("form.querySelector('", "last.querySelector('") \
                .replace("const form = " + sel['form'],
                         "const form = " + sel['form'] + "\n  const items = form ? [...form.querySelectorAll('" + sel['item'] + "')] : []\n  const last = items[items.length - 1] || null")


def run(app, sel, label_text, kind):
    drop_expr = DROP % sel['form']
    steps = [
        {'eval': drop_expr},
        {'drag': {'from': f'[title="{label_text}"]', 'toExpr': 'window.__drop', 'steps': 20}},
        {'wait': 1200},
        {'assert': measure_last_expr(sel)},
    ]
    return ev(app, None, steps=steps)


def diff(name, a, b, path=''):
    """递归打印差异（只报不同项）"""
    if isinstance(a, dict) and isinstance(b, dict):
        for k in a:
            diff(f'{name}.{k}' if name else k, a.get(k), (b or {}).get(k))
    elif a != b:
        flag = '⚠️ ' if (isinstance(a, int) and isinstance(b, int) and abs(a - b) > 1) else '  '
        print(f'  {flag}{name:34s} 参考={a!r:>18}  我们={b!r}')


if __name__ == '__main__':
    print('=== 画布级 A/B：单行输入 ===')
    ref = run(REF, CANVAS['ref'], '单行输入', 'ref')
    ours = run(OURS, CANVAS['ours'], '单行输入', 'ours')
    if not ref or not ours:
        raise SystemExit('两边都要取到数才能对比')
    print()
    diff('', ref, ours)
