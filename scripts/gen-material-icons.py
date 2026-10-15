#!/usr/bin/env python3
"""从参考实现 variant-form 提取物料图标，生成 packages/materials/src/icons.ts。

参考实现用 svg-sprite-loader 生成雪碧图再 <use xlink:href="#icon-xxx"> 引用；
本仓库为避免引入额外构建链，把 <path> 内联进 TS 模块。

用法（参考实现的 icons 目录要先存在）：
    python3 scripts/gen-material-icons.py [--ref /path/to/variant-form]

改图标时改本文件的 GROUPS / EXTRA / HANDMADE，然后重跑。
"""
import argparse
import os
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--ref', default='/Users/unravel/variant-form',
                    help='参考实现根目录（需含 src/icons/svg/）')
_args = parser.parse_args()

SRC = os.path.join(_args.ref, 'src/icons/svg')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'packages/materials/src/icons.ts')

GROUPS = {
    '容器': ['grid', 'table', 'tab', 'card'],
    '基础字段': ['text-field', 'textarea-field', 'number-field', 'radio-field', 'checkbox-field',
                 'select-field', 'time-field', 'time-range-field', 'date-field', 'date-range-field',
                 'switch-field', 'rate-field', 'color-field', 'slider-field', 'static-text',
                 'html-text', 'button', 'divider'],
    '高级字段': ['picture-upload-field', 'file-upload-field', 'rich-editor-field', 'cascader-field'],
    '自定义扩展字段': ['alert'],
}
EXTRA = ['data-table']

# 本仓库额外物料的自绘图标（参考实现没有对应物料，无现成图标可用）
# 风格与参考一致：1024 视图、纯填充 path、不写 fill（继承 currentColor）
HANDMADE = {
    'image-display': (
        '<path d="M896 128H128a64 64 0 0 0-64 64v640a64 64 0 0 0 64 64h768a64 64 0 0 0 64-64V192a64 64 0 0 0-64-64zm0 704H128V192h768v640z"/>'
        '<path d="M320 448a64 64 0 1 0 0-128 64 64 0 0 0 0 128z"/>'
        '<path d="M192 704h640L608 416 448 608l-96-96z"/>'
    ),
}

names = []
for v in GROUPS.values():
    names += v
names += EXTRA
names += list(HANDMADE)


def inner_markup(path):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    body = re.search(r'<svg[^>]*>(.*)</svg>', raw, re.S)
    body = body.group(1) if body else raw
    body = re.sub(r'<defs>.*?</defs>', '', body, flags=re.S)
    body = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.S)
    # 只保留 path（这些图标都是单 path 或纯 path）
    paths = re.findall(r'<path\b[^>]*/?>', body)
    return ''.join(paths)


entries = []
for n in names:
    if n in HANDMADE:
        entries.append((n, HANDMADE[n]))
        continue
    p = f'{SRC}/{n}.svg'
    markup = inner_markup(p)
    if not markup:
        raise SystemExit(f'{n}: 没有抽到 path')
    # 压缩属性间的多余空白
    markup = re.sub(r'\s+', ' ', markup).strip()
    entries.append((n, markup))

lines = []
lines.append('/**')
lines.append(' * 物料面板图标：从参考实现 `variant-form/src/icons/svg/*.svg` 内联而来。')
lines.append(' *')
lines.append(' * 参考实现用 `svg-sprite-loader` 生成雪碧图再 `<use xlink:href="#icon-xxx">` 引用；')
lines.append(' * 本仓库为避免额外构建链，直接把 `<path>` 内联进来，渲染成')
lines.append(' * `<svg viewBox="0 0 1024 1024"><path .../></svg>`。')
lines.append(' *')
lines.append(' * 这些图标本身不写 `fill`，因此继承 `currentColor`——颜色交给 CSS，与参考实现一致。')
lines.append(' *')
lines.append(' * ⚠️ 本文件由脚本从参考实现生成，请勿手工编辑路径数据；')
lines.append(' * 需要换图标时改这里的键名并同步 `manifest.ts` 的 `icon` 字段。')
lines.append(' */')
lines.append('export interface MaterialIcon {')
lines.append('  /** 统一为 1024×1024 视图，与参考实现一致 */')
lines.append('  viewBox: string')
lines.append('  /** `<path>` 等内部标记，供 v-html 注入 */')
lines.append('  inner: string')
lines.append('}')
lines.append('')
lines.append('export const MATERIAL_ICONS: Record<string, MaterialIcon> = {')
for n, markup in entries:
    lines.append(f"  {n!r}: {{ viewBox: '0 0 1024 1024', inner: {markup!r} }},")
lines.append('}')
lines.append('')
lines.append('/** 图标键 → 分组，仅用于文档与校验 */')
lines.append('export const ICON_GROUPS: Record<string, string[]> = {')
for g, v in GROUPS.items():
    lines.append(f'  {g!r}: [' + ', '.join(repr(x) for x in v) + '],')
lines.append('}')
lines.append('')

open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print(f'已写出 {OUT}：{len(entries)} 个图标，{os.path.getsize(OUT)} 字节')
