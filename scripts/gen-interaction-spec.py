#!/usr/bin/env python3
"""从可执行断言表生成交互规范文档。

**为什么用生成而不是手写**：手写的规范和测试会漂移——改了一边忘了另一边。
这里让 `scripts/spec-assertions.mjs` 成为**唯一来源**：

    断言表  →  ① scripts/browser-checks.mjs 的 spec-conformance 检查（真机执行）
            →  ② docs/interaction-spec/<物料>.md 的「验收标准」一节（文档）

两边引用同一组 id，所以"文档里写的每一条，都有一条对应的真机断言"是
**结构性保证**，不需要人去核对。

用法：
    python3 scripts/gen-interaction-spec.py           # 生成全部
    python3 scripts/gen-interaction-spec.py input     # 只生成指定物料
"""
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'docs' / 'interaction-spec'
SUMMARY = OUT / '验收标准总表.md'

# ⚠️ 这三份是**手写的详细规范**（每份 300~460 行，含设计态/运行态/校验语义等，
#    内容远超"默认渲染 + 单属性效果"）。生成器**绝不覆盖它们**，
#    它们的验收标准改为指向总表。
HAND_WRITTEN = {'input', 'radio', 'select'}

DUMP = r'''
import { MATERIAL_MANIFESTS } from "./packages/materials/src/manifest.ts"
import { normalizeAssertions } from "./scripts/spec-assertions.mjs"
const assertions = normalizeAssertions()
const materials = MATERIAL_MANIFESTS.filter((m) => !m.hidden).map((m) => ({
  type: m.type, name: m.name, category: m.category,
  description: m.description ?? '',
  droppable: !!m.droppable,
  defaultProps: m.defaultProps ?? {},
  propConfigs: (m.propConfigs ?? []).map((c) => ({
    name: c.name, label: c.label ?? c.name, control: c.control, group: c.group,
    defaultValue: c.defaultValue === undefined ? null : c.defaultValue,
    visibleWhen: c.visibleWhen ?? null,
    options: (c.options ?? []).map((o) => o.label ?? String(o.value)),
  })),
}))
console.log(JSON.stringify({ materials, assertions }))
'''


def load_data():
    """用 vite-node 无法直接跑 TS，这里复用 dev server 的模块解析：
    改成用 node 的 --experimental-strip-types（Node 22+ 原生支持 TS 语法剥离）。"""
    cmd = ['node', '--experimental-strip-types', '--no-warnings', '-e', DUMP]
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f'导出数据失败:\n{(r.stderr or r.stdout)[-800:]}')
    # 只取最后一行 JSON（模块可能有日志输出）
    line = [l for l in r.stdout.strip().splitlines() if l.startswith('{')][-1]
    return json.loads(line)


def render(material: dict, checks: list) -> str:
    t = material['type']
    props = material['propConfigs']
    common = [p for p in props if p['group'] == 'common']
    adv = [p for p in props if p['group'] == 'advanced']

    def prop_row(p):
        dw = ''
        if p['visibleWhen']:
            vw = p['visibleWhen']
            dw = f"（仅当 `{vw.get('prop')}` {'≠' if 'notEquals' in vw else '='} `{vw.get('notEquals', vw.get('equals'))}` 时可见）"
        opts = f" 选项：{'/'.join(p['options'][:8])}" if p['options'] else ''
        return f"| `{p['name']}` | {p['label']} | `{p['control']}` | `{p['defaultValue']}` | {dw}{opts} |"

    lines = [
        f"# {t} · {material['name']}",
        '',
        '> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**',
        '> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；',
        '> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。',
        '',
        '## 一、组件身份',
        '',
        '| 项 | 值 |',
        '| --- | --- |',
        f"| 类型 | `{t}` |",
        f"| 名称 | {material['name']} |",
        f"| 分组 | {material['category']} |",
        f"| 可放置容器 | {'是' if material['droppable'] else '否'} |",
        f"| 说明 | {material['description'] or '—'} |",
        '',
        '## 二、默认属性',
        '',
        '```json',
        json.dumps(material['defaultProps'], ensure_ascii=False, indent=2),
        '```',
        '',
        '## 三、属性面',
        '',
        '### 通用设置',
        '',
        '| prop | 面板标签 | 控件 | 默认值 | 备注 |',
        '| --- | --- | --- | --- | --- |',
        *([prop_row(p) for p in common] or ['| — | — | — | — | 无 |']),
        '',
        '### 高级设置',
        '',
        '| prop | 面板标签 | 控件 | 默认值 | 备注 |',
        '| --- | --- | --- | --- | --- |',
        *([prop_row(p) for p in adv] or ['| — | — | — | — | 无 |']),
        '',
        '## 四、验收标准',
        '',
        '> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，',
        '> 由 `pnpm verify:browser -- --only spec-conformance` 执行。',
        '> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。',
        '',
        '| # | 断言 id | 验收标准 | 前置属性 | 状态 |',
        '| --- | --- | --- | --- | --- |',
    ]
    for idx, a in enumerate(checks, 1):
        props = f"`{json.dumps(a['props'], ensure_ascii=False)}`" if a.get('props') else '默认'
        lines.append(f"| {idx} | `{a['id']}` | {a['desc']} | {props} | ✅ |")

    lines += [
        '',
        '## 五、怎么跑',
        '',
        '```bash',
        '# 需要 dev server（默认 5174）',
        'pnpm verify:browser -- --url http://localhost:5174/ --only spec-conformance',
        '```',
        '',
        '## 六、这张表的边界',
        '',
        '- 只覆盖**默认渲染 + 可断言的单属性效果**。',
        '- 交互后才出现的效果（悬停才出现的清除图标、聚焦才出现的浮层、拖拽中间状态）',
        '  **不在本表**，由 `scripts/browser-checks.mjs` 里各自的专项检查覆盖。',
        '- 事件绑定、动作链、数据源的运行时行为不在本表。',
        '',
    ]
    return '\n'.join(lines)


def render_summary(materials, assertions) -> str:
    lines = [
        '# 验收标准总表',
        '',
        '> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**',
        '> 唯一来源是 `scripts/spec-assertions.mjs`；同一张表由',
        '> `pnpm verify:browser -- --only spec-conformance` 在真实浏览器里执行。',
        '',
        f'覆盖 **{sum(1 for m in materials if assertions.get(m["type"]))}** 个物料、'
        f'**{sum(len(assertions.get(m["type"], [])) for m in materials)}** 条断言。',
        '',
        '## 为什么要这张表',
        '',
        '手写的规范和测试会漂移——改了一边忘了另一边。这里让断言表成为**唯一来源**：',
        '文档和真机检查引用同一组 id，所以"文档里写的每一条都有对应断言"',
        '不需要人去核对。',
        '',
        '## 覆盖范围与边界',
        '',
        '| 覆盖 | 不覆盖 |',
        '| --- | --- |',
        '| 默认渲染（根元素/结构/数量） | 交互后才出现的效果（悬停才出现的清除图标、聚焦浮层、拖拽中间态） |',
        '| 可断言的单属性效果（设值 → DOM 变化） | 事件绑定、动作链、数据源的运行时行为 |',
        '| 与参考实现对齐的关键尺寸 | 依赖具体数据的内容渲染 |',
        '',
        '## 内部结构件说明',
        '',
        '`grid-col` / `layout-table-row` / `layout-table-cell` / `tab-pane` **不在本表**：',
        '它们不是可拖拽物料，`insertMaterial` 插不进去；更糟的是**失败的插入会污染引擎状态**',
        '（实测：连续失败 4 次之后，连 `card` 都不再出现在画布上）。',
        '它们的行为归入各自父级物料的验收标准。',
        '',
    ]
    for m in materials:
        checks = assertions.get(m['type'])
        if not checks:
            continue
        tag = '（另有手写详细规范）' if m['type'] in HAND_WRITTEN else ''
        lines += [
            f'## {m["name"]} · `{m["type"]}` {tag}',
            '',
            '| # | 断言 id | 验收标准 | 前置属性 |',
            '| --- | --- | --- | --- |',
        ]
        for idx, a in enumerate(checks, 1):
            props = f'`{json.dumps(a["props"], ensure_ascii=False)}`' if a.get('props') else '默认'
            lines.append(f'| {idx} | `{a["id"]}` | {a["desc"]} | {props} |')
        lines.append('')
    return '\n'.join(lines)


def main():
    data = load_data()
    only = set(sys.argv[1:])
    materials = data['materials']
    assertions = data['assertions']

    written = 0
    skipped = []
    for m in materials:
        t = m['type']
        if only and t not in only:
            continue
        checks = assertions.get(t)
        if not checks:
            skipped.append(t)
            continue
        if t in HAND_WRITTEN:
            # 手写规范保留原样，不覆盖
            continue
        (OUT / f'{t}.md').write_text(render(m, checks), encoding='utf-8')
        written += 1

    SUMMARY.write_text(render_summary(materials, assertions), encoding='utf-8')

    covered = sum(len(assertions.get(m['type'], [])) for m in materials)
    print(f'已生成 {written} 份规范，共 {covered} 条验收标准')
    if skipped:
        print(f'⚠️ 未覆盖（无断言、多为内部结构件）：{", ".join(skipped)}')
    print(f'已生成总表：{SUMMARY.name}（{len(assertions)} 个物料）')
    print(f'输出目录：{OUT}')


if __name__ == '__main__':
    main()
