# 上游样式差异报告（Element UI → Element Plus）

> 由 `pnpm --filter @lowcode/materials test` 自动生成，请勿手工编辑。
>
> 覆盖的是现有 `conformance` 审计**够不到**的那一层：props / events 之外的
> **上游 CSS 语义变化**。这类问题静态审计看不见、happy-dom（无布局引擎）测不到、
> 单测断言 inline style 字符串也测不到，只能靠机械比对或真机复核。

## 汇总

| 指标 | 数值 |
| --- | --- |
| 物料用到的根选择器 | 29 |
| 两边都有、参与比对的选择器 | 421 |
| 🔴 语义变化 | 17 |
| 🟠 布局差异 | 1 |
| ⚪ 前缀噪音 | 11 |
| ⛔ 其中**会让我们失效**的（见下） | 1 |
| ✅ 已复核（有结论，见下） | 18 |
| ⬜ 尚未复核 | 0 |

## 判定口径

"上游把某元素的 display 改成 flex"**本身不是 bug**，必须叠加"我们在它的子项上绑了 `display`"
才成立——那时子项成了 flex item，`display` 被块化（`inline` → `block`），我们的绑定静默失效。

因此分两层：

- **⛔ 会让我们失效**：命中下列容器的语义变化，**测试会强制拦截**（必须修或登记 `CSS_WAIVERS`）
  - `.el-radio-group` —— Radio.vue 在 .el-radio / .el-radio-button 上绑 displayStyle
  - `.el-checkbox-group` —— Checkbox.vue 在 .el-checkbox / .el-checkbox-button 上绑 displayStyle
- **🔴 其余语义变化**：只进报告供人工判断，多半与我们无关（我们没在它们的子项上绑 display）

## 🔴 语义变化（17）

> 容器从 block/inline-block 变成 flex —— 子项的 `display` 会被 CSS 规范「块化」（`inline` → `block`），凡是在子项上绑 `display` 的实现都会静默失效（radio 的 `displayStyle` 就是这么坏的）

| 选择器 | 属性 | Element UI | Element Plus | 归属根 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `.el-button` | display | `inline-block` | `inline-flex` | `.el-button` | ✅ 已复核 |
| `.el-checkbox` | display | `inline-block` | `inline-flex` | `.el-checkbox` | ✅ 已复核 |
| `.el-checkbox__input` | display | `inline-block` | `inline-flex` | `.el-checkbox` | ✅ 已复核 |
| `.el-color-picker__trigger` | display | `inline-block` | `inline-flex` | `.el-color-picker` | ✅ 已复核 |
| `.el-input` | display | `inline-block` | `inline-flex` | `.el-input` | ✅ 已复核 |
| `.el-input-group` | display | `inline-table` | `inline-flex` | `.el-input` | ✅ 已复核 |
| `.el-input-group__append` | display | `table-cell` | `inline-flex` | `.el-input` | ✅ 已复核 |
| `.el-input-group__prepend` | display | `table-cell` | `inline-flex` | `.el-input` | ✅ 已复核 |
| `.el-input-number` | display | `inline-block` | `inline-flex` | `.el-input-number` | ✅ 已复核 |
| `.el-radio` | display | `inline-block` | `inline-flex` | `.el-radio` | ✅ 已复核 |
| `.el-radio-group` | display | `inline-block` | `inline-flex` | `.el-radio-group` | ⛔ 会让我们失效 |
| `.el-radio__input` | display | `inline-block` | `inline-flex` | `.el-radio` | ✅ 已复核 |
| `.el-switch__core` | display | `inline-block` | `inline-flex` | `.el-switch` | ✅ 已复核 |
| `.el-tabs__item` | display | `inline-block` | `flex` | `.el-tabs` | ✅ 已复核 |
| `.el-upload` | display | `inline-block` | `inline-flex` | `.el-upload` | ✅ 已复核 |
| `.el-upload-list--picture-card` | display | `inline` | `inline-flex` | `.el-upload` | ✅ 已复核 |
| `.el-upload-list__item-name` | display | `block` | `inline-flex` | `.el-upload` | ✅ 已复核 |

## 🟠 布局差异（1）

> position / z-index / overflow / flex 容器属性等发生变化

| 选择器 | 属性 | Element UI | Element Plus | 归属根 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `.el-slider__button-wrapper` | z-index | `1001` | `1` | `.el-slider` | ✅ 已复核 |

## ⚪ 前缀噪音（11）

> 只是 -webkit-box / -webkit-flex 之类的前缀现代化，无行为差异，可忽略

<details><summary>展开（11 条，无需处理）</summary>

| 选择器 | 属性 | Element UI | Element Plus | 归属根 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `.el-cascader-node` | display | `-webkit-box` | `flex` | `.el-cascader` | — |
| `.el-cascader-panel` | display | `-webkit-box` | `flex` | `.el-cascader` | — |
| `.el-cascader__suggestion-item` | display | `-webkit-box` | `flex` | `.el-cascader` | — |
| `.el-cascader__tags` | display | `-webkit-box` | `flex` | `.el-cascader` | — |
| `.el-image-viewer__actions__inner` | display | `-webkit-box` | `flex` | `.el-image` | — |
| `.el-image-viewer__btn` | display | `-webkit-box` | `flex` | `.el-image` | — |
| `.el-image-viewer__canvas` | display | `-webkit-box` | `flex` | `.el-image` | — |
| `.el-message` | display | `-webkit-box` | `flex` | `.el-message` | — |
| `.el-switch` | display | `-webkit-inline-box` | `inline-flex` | `.el-switch` | — |
| `.el-table__empty-block` | display | `-webkit-box` | `flex` | `.el-table` | — |
| `.el-tabs__nav.is-stretch` | display | `-webkit-box` | `flex` | `.el-tabs` | — |

</details>

## 怎么用这份报告

1. **⛔ 会让我们失效**：必须处理——把容器语义恢复成 Element UI 的取值，
   或登记 `CSS_WAIVERS` 说明为什么不影响。已修的案例见
   `packages/materials/src/components/Radio.vue` 的 `<style>` 块。
2. **🔴 其余语义变化**：逐条问一句"我们在它的子项上绑 display 了吗"。没有就跳过；
   拿不准的用真机复核（`scripts/cdp-inspect.mjs`，方法见 `docs/interaction-spec/README.md` 7.8）。
3. **🟠 布局差异**：`z-index` 影响浮层遮挡，`position` 影响下拉/面板定位，值得逐条看。
4. **⚪ 前缀噪音**不用管。

## 已复核结论

只列**实际复核过**的条目（真机取证或代码核对）。未列出的非致命差异仍未复核——
它们不参与拦截，需要时按上面的口径逐条判断。

| 选择器 | 属性 | 结论 |
| --- | --- | --- |
| `.el-radio-group` | display | 已修：EP 把容器改成 inline-flex，会使选项 display 被块化、displayStyle 静默失效。Radio.vue 用 :deep 把容器恢复成 inline-block。真机实测 inline→1 行 / block→3 行 ✅ |
| `.el-radio` | display | 已修（同上）：容器已恢复为非 flex，因此 .el-radio 自身的 inline-block → inline-flex 不再影响我们绑在它上面的 display。真机实测 computed 与预期一致 ✅ |
| `.el-checkbox` | display | 已修：本组件原先只在 block 时设样式，inline 时会落到 EP 默认的 inline-flex（参考实现给的是 inline，两者在间距/基线对齐上不等价）。已改成无条件绑定。真机实测 inline→computed inline、block→3 行 ✅ |
| `.el-checkbox__input` | display | 不适用：我们只在 .el-checkbox 本身上绑 display，不在它的子项上绑，故容器是否 flex 无影响 |
| `.el-input` | display | 不适用：我们在 ElInput 本身上没有绑 display，其内部 wrapper 也未被我们改样式 |
| `.el-input-group__append` | display | 已复核：机制由 inline-table/table-cell 换成 flex，但"输入框 + 后置按钮并排"的结果保住了。真机实测：组 inline-flex、同一行 ✅、水平相邻 ✅、输入框 730px + 后置区 40px 与组宽 814px 相符 |
| `.el-input-group__prepend` | display | 未使用：本仓库的 Input 只实现后置按钮（appendButton），没有 prepend 入口 |
| `.el-tabs__item` | display | 已复核：我们在 Tab.vue 未绑 display。真机实测 2 个标签项同行渲染正常（各 84×40，同一行）✅ |
| `.el-slider__button-wrapper` | z-index | 已复核：z-index 由 1001 降到 1，但手柄仍高于轨道（轨道 z-index 为 auto）。真机实测手柄中心正好落在轨道起点（x:275 = 轨道起点 293 − 半个手柄宽 18），位置正确 ✅ |
| `.el-button` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-color-picker__trigger` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-input-group` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-input-number` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-radio__input` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们（我们在 .el-radio 本身上绑，不在它的子项上绑） |
| `.el-switch__core` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-upload` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-upload-list--picture-card` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-upload-list__item-name` | display | 不适用：本仓库**只有 Radio.vue 与 Checkbox.vue 两处**把 display 绑到 Element Plus 元素上（`grep -rn "display:" packages/materials/src/components/*.vue` 可复现），其余组件的 display 都写在自身 class 上。故「容器变 flex 导致子项块化」不会影响我们 |
| `.el-checkbox__inner` | z-index | 不适用：层级只在组件内部生效，未观测到遮挡（复选框渲染正常） |
| `.el-table__column-resize-proxy` | z-index | 不适用：列宽拖拽时的临时提示层；本仓库未使用该交互（列宽走属性面板） |
| `.el-tabs__nav` | z-index | 不适用：标签导航层级变化未观测到影响（真机实测 2 个标签项同行渲染正常） |

真机取证方法：`scripts/cdp-inspect.mjs`（见 `docs/interaction-spec/README.md` 7.8）。

## 已知局限

- 只比对**两边都有**的选择器；Element Plus 新增的规则不在范围内
  （新增通常表现为"多了一层 wrapper"，需要真机看）。
- 解析器不处理 `@media` 嵌套：媒体查询里的覆盖值会参与比对，可能产生误报。
- 只覆盖布局关键属性；颜色/圆角/字号等视觉细节不在范围。
- `CRITICAL_CONTAINERS` 是**手工登记**的：新增在子项上绑 display 的组件时，
  必须同步登记，否则该组件不会被拦截。
