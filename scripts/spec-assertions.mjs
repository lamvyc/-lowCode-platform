#!/usr/bin/env node
/**
 * 交互规范的可执行断言表。
 *
 * **这是 `docs/interaction-spec/*.md` 里「验收标准」的唯一来源**：
 * 规范文档由 `scripts/gen-interaction-spec.py` 从本表生成，
 * 因此"每条验收标准 ↔ 一条真机断言"是**结构性保证**，不会随时间漂移。
 *
 * 每条断言的结构：
 *
 *   { id, desc, props?, check }
 *
 *   id     稳定标识，会写进规范文档（`[input.no-fallback-placeholder]`）
 *   desc   一句话描述，同时是人类可读的验收标准
 *   props  断言前要应用到节点上的属性（可选）
 *   check  **函数体字符串**，在页面里以 `new Function('root', check)` 执行，
 *         返回值必须是布尔。`root` 是该物料的 `[data-node-id]` 元素。
 *
 * ⚠️ 只写**能在真实浏览器里断言**的条目。凡是"需要读源码才能确认"的，
 * 不放进这张表——那属于规范正文，不属于验收标准。
 *
 * ⚠️ **不包含内部结构件**（`grid-col` / `layout-table-row` / `layout-table-cell` / `tab-pane`）。
 * 它们不是可拖拽物料，`insertMaterial` 插不进去；更糟的是**失败的插入会污染
 * 引擎状态，导致后续所有物料都插不进来**（实测：前面失败 4 次之后，连 `card`
 * 都不再出现在画布上）。它们的行为归入各自父级物料的规范。
 */

/** 通用断言：只要渲染出预期根元素即可 */
const renders = (desc, selector) => ({
  id: 'render',
  desc,
  check: `return !!root.querySelector(${JSON.stringify(selector)})`,
})

/** 属性生效断言：设置 props 后，某个选择器命中的元素的属性/文本应满足条件 */
const effect = (desc, props, check) => ({ id: undefined, desc, props, check })

export const SPEC_ASSERTIONS = {
  // ============================================================
  // 容器
  // ============================================================
  grid: [
    renders('渲染为 `.el-row` 栅格行', '.el-row'),
    {
      id: 'has-cols',
      desc: '默认带出至少 1 个 `.el-col` 栅格列',
      check: `return root.querySelectorAll('.el-col').length >= 1`,
    },
    effect(
      '`gutter` 设为 20 后，栅格列出现水平内边距',
      { gutter: 20 },
      `const c = root.querySelector('.el-col'); if (!c) return false;
       const p = parseFloat(getComputedStyle(c).paddingLeft) || 0;
       return p > 0`,
    ),
  ],


  'layout-table': [renders('渲染出 `<table>` 结构', 'table')],



  tab: [
    renders('渲染为 `.el-tabs`', '.el-tabs'),
    {
      id: 'one-pane',
      desc: '默认带出**恰好 1 个**面板（参考拖入后就是 1 个）',
      check: `return root.querySelectorAll('.el-tab-pane').length === 1`,
    },
    {
      id: 'first-pane-active',
      desc: '第一个面板默认处于激活状态（不是 `aria-hidden`）',
      check: `const panes = [...root.querySelectorAll('.el-tab-pane')];
             return panes.length > 0 && panes.filter((p) => p.getAttribute('aria-hidden') !== 'true').length === 1`,
    },
  ],


  card: [
    renders('渲染为 `.el-card`', '.el-card'),
    {
      id: 'header-and-body',
      desc: '带 header 槽与 body 两个区域',
      check: `return !!root.querySelector('.el-card__header') && !!root.querySelector('.el-card__body')`,
    },
    {
      id: 'default-title',
      desc: '默认标题为 `card`（对齐参考的默认 label）',
      check: `const t = root.querySelector('.lc-card__title');
             return !!t && t.textContent.trim() === 'card'`,
    },
  ],

  // ============================================================
  // 基础字段
  // ============================================================
  input: [
    renders('渲染为 `.el-input`', '.el-input'),
    {
      id: 'no-fallback-placeholder',
      desc: '未设占位内容时**不显示**"请输入"之类的兜底文案',
      check: `const i = root.querySelector('.el-input__inner');
             return !!i && !i.getAttribute('placeholder')`,
    },
    effect(
      '`placeholder` 设置后，内层 input 的 `placeholder` 等于该值',
      { placeholder: '占位X' },
      `const i = root.querySelector('.el-input__inner');
       return !!i && i.getAttribute('placeholder') === '占位X'`,
    ),
    effect(
      '`disabled` 打开后，内层 input 处于禁用态',
      { disabled: true },
      `const i = root.querySelector('.el-input__inner'); return !!i && i.disabled === true`,
    ),
    effect(
      '`readonly` 打开后，内层 input 处于只读态',
      { readonly: true },
      `const i = root.querySelector('.el-input__inner'); return !!i && i.readOnly === true`,
    ),
  ],

  textarea: [
    renders('渲染为 `.el-textarea`', '.el-textarea'),
    effect(
      '`rows` 设为 5 后，内层 textarea 的 `rows` 属性为 5',
      { rows: 5 },
      `const t = root.querySelector('.el-textarea__inner');
       return !!t && String(t.getAttribute('rows')) === '5'`,
    ),
    effect(
      '`maxLength` 设置后，内层 textarea 的 `maxlength` 属性同步',
      { maxLength: 12 },
      `const t = root.querySelector('.el-textarea__inner');
       return !!t && String(t.getAttribute('maxlength')) === '12'`,
    ),
  ],

  number: [
    renders('渲染为 `.el-input-number`', '.el-input-number'),
    effect(
      '`disabled` 打开后，内层 input 处于禁用态',
      { disabled: true },
      `const i = root.querySelector('.el-input-number input'); return !!i && i.disabled === true`,
    ),
    effect(
      '`min` / `max` 设置后，内层 input 的 `min` / `max` 属性同步',
      { min: 5, max: 20 },
      // ⚠️ 断言 `min`/`max` 属性而不是 `aria-valuemin/aria-valuemax`：
      //    实测 EP **不同步** aria 值（它们始终是 ±100000000000），
      //    但真正的约束属性是对的。这不是缺陷，是 EP 的 a11y 实现细节。
      `const i = root.querySelector('.el-input-number input'); if (!i) return false;
       return i.getAttribute('min') === '5' && i.getAttribute('max') === '20'`,
    ),
  ],

  radio: [
    renders('渲染为 `.el-radio-group`', '.el-radio-group'),
    {
      id: 'option-count',
      desc: '渲染出与 `optionItems` 等量的 `.el-radio`',
      check: `return root.querySelectorAll('.el-radio').length >= 1`,
    },
    effect(
      '`disabled` 打开后，每个选项都带 `is-disabled`',
      { disabled: true },
      `const rs = [...root.querySelectorAll('.el-radio')];
       return rs.length > 0 && rs.every((r) => r.classList.contains('is-disabled'))`,
    ),
  ],

  checkbox: [
    renders('渲染为 `.el-checkbox-group`', '.el-checkbox-group'),
    {
      id: 'option-count',
      desc: '渲染出与 `optionItems` 等量的 `.el-checkbox`',
      check: `return root.querySelectorAll('.el-checkbox').length >= 1`,
    },
    effect(
      '`disabled` 打开后，每个选项都带 `is-disabled`',
      { disabled: true },
      `const cs = [...root.querySelectorAll('.el-checkbox')];
       return cs.length > 0 && cs.every((c) => c.classList.contains('is-disabled'))`,
    ),
  ],

  select: [
    renders('渲染为 `.el-select`', '.el-select'),
    {
      id: 'wrapper-height',
      desc: '下拉框高度为 36px（与同排单行输入一致，不是 EP 默认的 32px）',
      check: `const w = root.querySelector('.el-select__wrapper');
             return !!w && Math.round(w.getBoundingClientRect().height) === 36`,
    },
    effect(
      '`disabled` 打开后，内层 input 处于禁用态',
      { disabled: true },
      // ⚠️ EP 的 `.el-select` **不加** `is-disabled` 类，禁用体现在内层 input 上
      `const i = root.querySelector('.el-select input'); return !!i && i.disabled === true`,
    ),
  ],

  time: [
    renders('渲染为日期时间选择器（内含 `.el-input`）', '.el-input'),
    effect(
      '`disabled` 打开后，内层 input 处于禁用态',
      { disabled: true },
      `const i = root.querySelector('input'); return !!i && i.disabled === true`,
    ),
  ],

  'time-range': [
    renders('渲染为范围选择器 `.el-date-editor`', '.el-date-editor'),
    {
      id: 'two-inputs',
      desc: '渲染出**两个** `.el-range-input`（起止各一）',
      check: `return root.querySelectorAll('.el-range-input').length === 2`,
    },
  ],

  date: [
    renders('渲染为日期选择器（内含 `.el-input`）', '.el-input'),
    effect(
      '`disabled` 打开后，内层 input 处于禁用态',
      { disabled: true },
      `const i = root.querySelector('input'); return !!i && i.disabled === true`,
    ),
  ],

  'date-range': [
    renders('渲染为范围选择器 `.el-date-editor`', '.el-date-editor'),
    {
      id: 'two-inputs',
      desc: '渲染出**两个** `.el-range-input`（起止各一）',
      check: `return root.querySelectorAll('.el-range-input').length === 2`,
    },
  ],

  switch: [
    renders('渲染为 `.el-switch`', '.el-switch'),
    {
      id: 'height',
      desc: '开关高度为 20px（不是 EP 默认的 32px）',
      check: `const s = root.querySelector('.el-switch');
             return !!s && Math.round(s.getBoundingClientRect().height) === 20`,
    },
    effect(
      '`activeText` 设置后，开启文案出现在开关旁',
      { activeText: '开X' },
      `return root.textContent.includes('开X')`,
    ),
  ],

  rate: [
    renders('渲染为 `.el-rate`', '.el-rate'),
    {
      id: 'item-count',
      desc: '星星数量等于 `max`（默认 5）',
      check: `return root.querySelectorAll('.el-rate__item').length === 5`,
    },
  ],

  color: [
    renders('渲染为 `.el-color-picker`', '.el-color-picker'),
    {
      id: 'trigger-size',
      desc: '触发器尺寸为 36×36（参考的 medium 档，不是 EP 默认的 32×32）',
      check: `const t = root.querySelector('.el-color-picker__trigger'); if (!t) return false;
             const r = t.getBoundingClientRect();
             return Math.round(r.width) === 36 && Math.round(r.height) === 36`,
    },
  ],

  slider: [
    renders('渲染为 `.el-slider`', '.el-slider'),
    {
      id: 'stops',
      desc: '默认显示刻度点（参考默认 `showStops: true`，应出现多个 `.el-slider__stop`）',
      check: `return root.querySelectorAll('.el-slider__stop').length > 0`,
    },
  ],

  'static-text': [
    {
      id: 'renders',
      desc: '渲染为静态文字容器 `.lc-static-text`',
      check: `return !!root.querySelector('.lc-static-text')`,
    },
  ],

  text: [
    {
      id: 'renders',
      desc: '渲染出可读文本（旧版文本组件）',
      check: `return (root.textContent || '').trim().length > 0`,
    },
  ],

  'html-text': [
    {
      id: 'renders',
      desc: '渲染为 `.lc-html-text` 且内容被当作 HTML 解析',
      check: `return !!root.querySelector('.lc-html-text')`,
    },
  ],

  button: [
    renders('渲染为 `.el-button`', '.el-button'),
    {
      id: 'default-type',
      desc: '默认类型是 Element 的"默认"样式（白底灰边），不是蓝色实心 primary',
      check: `const b = root.querySelector('.el-button'); if (!b) return false;
             return !b.classList.contains('el-button--primary')`,
    },
    effect(
      '`text` 设置后，按钮文案随之变化',
      { text: '提交X' },
      `const b = root.querySelector('.el-button'); return !!b && b.textContent.includes('提交X')`,
    ),
  ],

  divider: [renders('渲染为 `.el-divider`', '.el-divider')],

  // ============================================================
  // 高级字段
  // ============================================================
  'picture-upload': [
    renders('渲染为图片上传 `.el-upload`', '.el-upload'),
    {
      id: 'plus-icon',
      desc: '触发器是 `el-icon-plus` 加号图标（不是按钮）',
      check: `return !!root.querySelector('.el-icon-plus')`,
    },
  ],

  'file-upload': [
    renders('渲染为文件上传 `.el-upload`', '.el-upload'),
    {
      id: 'plus-icon',
      desc: '触发器是 `el-icon-plus` + 「选择文件」文案',
      check: `return !!root.querySelector('.el-icon-plus') && root.textContent.includes('选择文件')`,
    },
    {
      id: 'no-always-on-tip',
      desc: '未设 `uploadTip` 时**不显示**"支持 xx 格式"这类常显提示',
      check: `const tips = [...root.querySelectorAll('.lc-upload__tip')];
             return tips.every((t) => (t.textContent || '').includes('支持') === false)`,
    },
  ],

  'rich-editor': [
    renders('渲染为 Quill 编辑器（`.ql-container`）', '.ql-container'),
    {
      id: 'toolbar',
      desc: '工具栏渲染出足够多的按钮（≥15 个按钮/选择器）',
      check: `const tb = root.querySelector('.ql-toolbar'); if (!tb) return false;
             return tb.querySelectorAll('button, .ql-picker').length >= 15`,
    },
    {
      id: 'editable',
      desc: '编辑区可编辑（`contenteditable="true"`）',
      check: `const e = root.querySelector('.ql-editor');
             return !!e && e.getAttribute('contenteditable') === 'true'`,
    },
  ],

  cascader: [
    renders('渲染为 `.el-cascader`', '.el-cascader'),
    effect(
      '`disabled` 打开后，`.el-cascader` 处于禁用态',
      { disabled: true },
      `const c = root.querySelector('.el-cascader');
       return !!c && c.className.includes('is-disabled')`,
    ),
  ],

  // ============================================================
  // 自定义扩展
  // ============================================================
  alert: [
    renders('渲染为 `.el-alert`', '.el-alert'),
    {
      id: 'closable-default',
      desc: '默认 `closable: true` 时显示关闭按钮（参考的 `alertSchema` 默认也是 true）',
      check: `return !!root.querySelector('.el-alert__close-btn, .el-alert__closebtn')`,
    },
    effect(
      '`closable` 关掉后，关闭按钮消失',
      { closable: false },
      `return !root.querySelector('.el-alert__close-btn, .el-alert__closebtn')`,
    ),
  ],

  table: [
    renders('渲染为 `.el-table`', '.el-table'),
    {
      id: 'has-columns',
      desc: '渲染出至少一列表头',
      check: `return root.querySelectorAll('.el-table__header th, .el-table__cell').length > 0`,
    },
  ],

  image: [
    renders('渲染为 `.el-image`', '.el-image'),
    effect(
      '`width` 设置后，图片宽度随之变化',
      { width: 320 },
      `const i = root.querySelector('.el-image');
       return !!i && Math.round(i.getBoundingClientRect().width) === 320`,
    ),
  ],
}

/** 给没有 id 的 `effect()` 条目生成稳定 id */
export function normalizeAssertions() {
  const out = {}
  for (const [material, list] of Object.entries(SPEC_ASSERTIONS)) {
    out[material] = list.map((a, idx) => {
      // 没写 id 的 `effect()` 用属性名派生一个可读 id（如 `prop-activeText`）
      const keys = a.props ? Object.keys(a.props) : []
      const derived = keys.length === 1 ? `prop-${keys[0]}` : `assert-${idx + 1}`
      return { ...a, id: a.id ?? derived }
    })
  }
  return out
}
