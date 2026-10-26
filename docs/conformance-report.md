# 组件库一致性报告（参考实现 ↔ 本仓库）

> 由 `pnpm --filter @lowcode/materials test` 自动生成，请勿手工编辑。
> 参考实现目录：`/Users/unravel/variant-form/src`

## 汇总

| 指标 | 数值 |
| --- | --- |
| 参考组件数 | 28 |
| 已比对组件数 | 28 |
| 完全一致 | 28 |
| 存在差异 | 0 |
| 缺失组件 | 0 |
| 缺失属性 | 0 |
| 缺失事件 | 0 |
| 缺失 UI 绑定 | 0 |
| 已登记的有意偏离 | 7 |

## 明细

| 参考组件 | 本仓库类型 | 状态 | 缺失属性 | 缺失事件 | 缺失 UI 绑定 |
| --- | --- | --- | --- | --- | --- |
| grid | grid | ✅ | — | — | — |
| table | table | ✅ | — | — | — |
| tab | tab | ✅ | — | — | — |
| grid-col | grid-col | ✅ | — | — | — |
| table-cell | table-cell | ✅ | — | — | — |
| tab-pane | tab-pane | ✅ | — | — | — |
| input | input | ✅ | — | — | — |
| textarea | textarea | ✅ | — | — | — |
| number | number | ✅ | — | — | — |
| radio | radio | ✅ | — | — | — |
| checkbox | checkbox | ✅ | — | — | — |
| select | select | ✅ | — | — | — |
| time | time | ✅ | — | — | — |
| time-range | time-range | ✅ | — | — | — |
| date | date | ✅ | — | — | — |
| date-range | date-range | ✅ | — | — | — |
| switch | switch | ✅ | — | — | — |
| rate | rate | ✅ | — | — | — |
| color | color | ✅ | — | — | — |
| slider | slider | ✅ | — | — | — |
| static-text | static-text | ✅ | — | — | — |
| html-text | html-text | ✅ | — | — | — |
| button | button | ✅ | — | — | — |
| divider | divider | ✅ | — | — | — |
| picture-upload | picture-upload | ✅ | — | — | — |
| file-upload | file-upload | ✅ | — | — | — |
| rich-editor | rich-editor | ✅ | — | — | — |
| cascader | cascader | ✅ | — | — | — |

## 已登记的有意偏离（契约）

| 参考组件 | 类别 | 项目 | 原因 |
| --- | --- | --- | --- |
| grid | attr | `gridcolwidget:col-height` | 子节点由渲染器按 Schema 独立渲染，父容器无法向子组件传 prop；本平台用可继承的 CSS 变量把 colHeight 下传，并在 GridCol 上写成逐列 height —— 与参考的逐列高度语义等价，只是承载位置不同 |
| button | attr | `staticcontentwrapper:display-style` | 本实现没有 static-content-wrapper 外壳，displayStyle 直接换算为按钮自身宽度（block → 100%） |
| static-text | attr | `pre:style` | preWrap 用 div 的 white-space 表达，未使用 <pre> 元素（功能等价） |
| rich-editor | attr | `vueeditor:disabled` | 富文本为自研 contenteditable 实现（不引入第三方富文本库），disabled 由组件内部 DOM 处理 |
| rich-editor | attr | `vueeditor:placeholder` | 同上：占位文案由 contenteditable 的 :empty::before 实现 |
| radio | attr | `elradiobutton:border` | Element Plus 的 el-radio-button 已移除 border 属性（仅 el-radio 支持） |
| checkbox | attr | `elcheckboxbutton:border` | Element Plus 的 el-checkbox-button 已移除 border 属性（仅 el-checkbox 支持） |
| input | attr | `elbutton:class` | Element Plus 的按钮图标用 icon（组件）而非 class，本实现绑定为 :icon |

共 6 个组件命中上述契约，逐组件命中明细见 `docs/conformance-report.json`。

## 本仓库额外物料（信息性）

`card`、`alert`、`data-table`、`image`
