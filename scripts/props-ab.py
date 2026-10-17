#!/usr/bin/env python3
"""属性面板 A/B：对比「同一个组件能配什么」。

这是画布级 A/B 之外的**第三层**：物料面板（能拖什么）、画布（渲染成什么样）
都已经对比过，这一层是**能配什么**——用户真正上手改东西的地方。

两边的结构恰好对应：
    我们：`.lc-props-panel__content` → `.el-collapse-item` → `.lc-field` → `.lc-field__label`
    参考：`.panel-container .setting-form` → `.el-collapse-item` → `.el-form-item` → `.el-form-item__label`

所以对比的是：**每个分组下的属性标签序列**（以及各自的控件类型）。

用法：
    python3 scripts/props-ab.py              # 默认几个代表组件
    python3 scripts/props-ab.py 单行输入 单选项
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = Path('/Users/unravel/ lowCode-platform')
GETCTX = Path('/tmp/lc-probes/getctx.js').read_text()

REF = 'http://localhost:8090/'
OURS = 'http://localhost:5174/'

# 物料标签 → 我们 manifest 里的 type
TYPE_BY_LABEL = {
    '单行输入': 'input', '多行输入': 'textarea', '计数器': 'number',
    '单选项': 'radio', '多选项': 'checkbox', '下拉选项': 'select',
    '时间': 'time', '日期': 'date', '开关': 'switch', '评分': 'rate',
    '颜色选择器': 'color', '滑块': 'slider', '级联选择': 'cascader',
    '静态文字': 'static-text', 'HTML': 'html-text', '按钮': 'button',
    '分隔线': 'divider', '栅格': 'grid', '标签页': 'tab', '卡片': 'card',
    '文件': 'file-upload', '富文本': 'rich-editor', '提示': 'alert',
}

EXTRACT_OURS = '''(() => {
  // ⚠️ 必须做 null 保护：某些属性行可能没有 label 元素（如纯按钮行）
  const t = (el) => (el && el.textContent ? el.textContent : '').replace(/\\s+/g, ' ').trim()
  const kind = (row) => {
    if (row.querySelector('textarea')) return 'textarea'
    if (row.querySelector('.el-select')) return 'select'
    if (row.querySelector('.el-switch')) return 'switch'
    if (row.querySelector('.el-radio-group')) return 'radio'
    if (row.querySelector('.el-input-number')) return 'number'
    if (row.querySelector('.el-checkbox')) return 'checkbox'
    if (row.querySelector('input')) return 'input'
    if (row.querySelector('button')) return 'button'
    return 'other'
  }
  const groups = [...document.querySelectorAll('.lc-props-panel__content .el-collapse-item')]
  return JSON.stringify(groups.map((g) => ({
    组: t(g.querySelector('.el-collapse-item__header')).replace(/\\d+$/, '').trim(),
    项: [...g.querySelectorAll('.lc-field')].map((f) => ({
      标签: t(f.querySelector('.lc-field__label')).replace(/\\?$/, '').trim(),
      控件: kind(f),
    })),
  })).filter((g) => g.项.length > 0))
})()'''

EXTRACT_REF = '''(() => {
  // ⚠️ 必须做 null 保护：某些属性行可能没有 label 元素（如纯按钮行）
  const t = (el) => (el && el.textContent ? el.textContent : '').replace(/\\s+/g, ' ').trim()
  const kind = (row) => {
    if (row.querySelector('textarea')) return 'textarea'
    if (row.querySelector('.el-select')) return 'select'
    if (row.querySelector('.el-switch')) return 'switch'
    if (row.querySelector('.el-radio-group')) return 'radio'
    if (row.querySelector('.el-input-number')) return 'number'
    if (row.querySelector('.el-checkbox')) return 'checkbox'
    if (row.querySelector('input')) return 'input'
    if (row.querySelector('button')) return 'button'
    return 'other'
  }
  // ⚠️ 只取**组件设置**那个 tab pane 里的分组：
  //   参考的「表单设置」tab 也渲染在同一棵树里（基本属性 / 全局组件大小 / 数据对象名称 …），
  //   那是**表单级设置**，把它算进"组件属性"会让参考的项数虚高十几条（第一版就踩了）。
  const panes = [...document.querySelectorAll('.panel-container .el-tabs__content > .el-tab-pane')]
  const pane = panes.find((p) => p.querySelector('.setting-form .el-collapse-item')) || document
  const groups = [...pane.querySelectorAll('.setting-form .el-collapse-item')]
  return JSON.stringify(groups.map((g) => ({
    组: t(g.querySelector('.el-collapse-item__header')).replace(/\\d+$/, '').trim(),
    项: [...g.querySelectorAll('.el-form-item')].map((f) => ({
      标签: t(f.querySelector('.el-form-item__label')).replace(/\\?$/, '').trim(),
      控件: kind(f),
    })),
  })).filter((g) => g.项.length > 0))
})()'''


def ev(url, wait, steps):
    cmd = ['node', 'scripts/cdp-inspect.mjs', '--url', url,
           '--width', '1600', '--height', '900', '--wait', wait,
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
        print(f'    ⚠️ 取数失败: {(r.stderr or r.stdout).strip()[-180:]}')
    return found


def ours_panel(label, type_name):
    steps = [
        {'eval': GETCTX},
        {'eval': f"(() => {{ const ctx = __getCtx(); ctx.insertMaterial('{type_name}'); return 'ok' }})()"},
        {'wait': 900},
        {'eval': f"(() => {{ const ctx = __getCtx(); const n = __unref(ctx.schema).nodes.find((x) => x.type === '{type_name}'); if (!n) return 'NO_NODE'; ctx.selectNode(n.id); return 'ok' }})()"},
        {'wait': 700},
        {'assert': EXTRACT_OURS},
    ]
    return ev(OURS, '.lc-canvas', steps)


def ref_panel(label):
    steps = [
        {'eval': "(() => { const f = document.querySelector('.widget-form').getBoundingClientRect(); window.__d = { x: Math.round(f.left + 120), y: Math.round(f.top + 60) }; return 'ok' })()"},
        {'drag': {'from': f'[title="{label}"]', 'toExpr': 'window.__d', 'steps': 20}},
        {'wait': 1000},
        {'click': '.widget-form .el-form-item, .widget-form .container-wrapper'},
        {'wait': 800},
        {'assert': EXTRACT_REF},
    ]
    return ev(REF, '#app', steps)


def flat(panel):
    """展平成 (组, 标签, 控件)。

    ⚠️ 排除**事件**分组：参考的「事件属性」（onCreated/onMounted/onChange…）
    和组件属性渲染在同一个 pane 的同一棵 collapse 里，而我们的「事件设置」行
    不是 `.lc-field`（抽取时被过滤掉了）。两边口径不一致时，
    参考的 6~8 条事件会被算成"我们没有的属性"。
    本层只比**能配的组件属性**，事件绑定另算。
    """
    return [(g['组'], i['标签'], i['控件'])
            for g in panel if '事件' not in g['组']
            for i in g['项']]


def main():
    labels = sys.argv[1:] or ['单行输入', '单选项', '下拉选项', '开关', '按钮']
    summary = []
    for label in labels:
        type_name = TYPE_BY_LABEL.get(label)
        if not type_name:
            print(f'{label:8s} ⚠️ 未登记 type'); continue
        ours = ours_panel(label, type_name)
        ref = ref_panel(label)
        if not ours or not ref:
            print(f'{label:8s} ⚠️ 取数失败'); summary.append((label, -1, [])); continue
        fo, fr = flat(ours), flat(ref)
        issues = []
        lo = [x[1] for x in fo]
        lr = [x[1] for x in fr]
        only_ref = [x for x in lr if x not in lo]
        only_ours = [x for x in lo if x not in lr]
        if only_ref:
            issues.append(('参考有我们没有', ' / '.join(only_ref[:8]), f'{len(only_ref)} 项'))
        if only_ours:
            issues.append(('我们有参考没有', ' / '.join(only_ours[:8]), f'{len(only_ours)} 项'))
        if lo == lr:
            pass
        elif not only_ref and not only_ours:
            issues.append(('顺序不同', ' / '.join(lr[:6]), ' / '.join(lo[:6])))
        # 控件类型不同的同名属性
        mo = {x[1]: x[2] for x in fo}
        for lt, ct in {x[1]: x[2] for x in fr}.items():
            if lt in mo and mo[lt] != ct:
                issues.append((f'控件类型 @ {lt}', ct, mo[lt]))

        if not issues:
            print(f'{label:8s} ✅ 一致（{len(fr)} 项）')
        else:
            print(f'{label:8s} ❌ {len(issues)} 类差异（参考 {len(fr)} 项 / 我们 {len(fo)} 项）')
            for name, a, b in issues[:6]:
                print(f'          {name:22s} 参考={str(a)[:52]:<52} 我们={str(b)[:40]}')
        summary.append((label, len(issues), issues))

    print('\n' + '=' * 74)
    ok = [s for s in summary if s[1] == 0]
    bad = [s for s in summary if s[1] > 0]
    fail = [s for s in summary if s[1] < 0]
    print(f'一致 {len(ok)} / 有差异 {len(bad)} / 未取到 {len(fail)}   （共 {len(summary)} 个）')
    Path('/tmp/lc-probes/props-ab.json').write_text(
        json.dumps([{'label': l, 'issues': n, 'detail': [[a, str(b), str(c)] for a, b, c in d]} for l, n, d in summary],
                   ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
