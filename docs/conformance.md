# 组件库一致性基线（自动比对参考实现）

移植过来的组件库，最怕的是「抄漏了 / 抄歪了」而没人发现。手工逐个组件比对不可持续，
所以把参考实现变成**可执行的验收基线**：从 `variant-form` 源码自动抽取每个组件的能力面，
与我们的物料清单/组件源码机器比对，差异要么补齐、要么显式登记。

## 一、怎么跑

```bash
# 参考实现目录（默认取仓库同级的 ../variant-form/src，也可显式指定）
export VARIANT_FORM_SRC=/path/to/variant-form/src

# 跑审计（同时是普通单测的一部分）
pnpm --filter @lowcode/materials test
# 或仓库根目录
pnpm conformance
```

产物：

- `docs/conformance-report.md` —— 人读的汇总与明细（自动生成，勿手改）
- `docs/conformance-report.json` —— 机器可读明细（CI 可据此做趋势/门禁）

参考实现目录不存在时，审计用例自动跳过（`describe.skipIf`），不影响 CI 上的常规测试。

## 二、比对了什么

从参考实现抽取三类信号，逐一比对：

| 维度 | 参考侧来源 | 本仓库侧来源 | 检出问题 |
| --- | --- | --- | --- |
| **属性** | `widgetsConfig.js` 的 options 键 + 模板里真正读取的 `field.options.X` | `manifest.ts` 的 `propConfigs` | 参考有、我们没有（含重命名映射） |
| **事件** | options 中的 `onXxx` 声明 | `manifest.ts` 的 `events[].label` | 参考声明的事件我们没有 |
| **UI 绑定** | widget 模板里 `:attr="...options.X"` 的 Element UI 组件属性 | 我们 SFC 模板里的 `:attr="..."` | 参考绑定到 Element 组件、我们没绑（漏传参数） |

另外还有一条**不依赖参考实现**的自检：
`manifest.propConfigs` 里的每个属性，都必须在对应组件的 `defineProps` 中真实声明
（否则面板会写到一个组件不认识的字段上，运行时静默失效）。

还有一条**分组对齐**审计（`conformance/prop-groups.test.ts`）：
属性面板的三个折叠区由参考的 `COMMON_PROPERTIES` / `ADVANCED_PROPERTIES` /
`EVENT_PROPERTIES` 三张注册表逐项决定。审计把这三张表解析成机器可读基线，逐 widget 检查
「通用设置 / 高级设置 / 事件设置」的归属是否与参考一致，以及事件属性是否一一对应
（参考没有的事件，如 `select` 的 `onClear`，不得出现在事件设置里）。

## 三、怎么读报告

```text
| 参考组件 | 本仓库类型 | 状态 | 缺失属性 | 缺失事件 | 缺失 UI 绑定 |
| input    | input      | ✅   | —        | —        | —            |
```

- `✅` 完全一致（差异都已登记或不存在）
- `⚠️ 差异` 有未登记差异 —— **测试会失败**，必须补齐或登记
- `❌ 缺失` 参考有该组件、我们没实现

## 四、"有意不同" 怎么登记

确实属于架构差异或上游 UI 库差异的，登记到
`packages/materials/src/conformance/audit.ts` 的 `WAIVERS`，**必须写原因**：

```ts
{
  widget: 'radio',            // 参考 widget 类型；'*' 表示对所有组件生效
  kind: 'attr',               // widget | option | event | attr
  reference: 'elradiobutton:border', // option 名 / 事件名 / `标签:属性`
  reason: 'Element Plus 的 el-radio-button 已移除 border 属性（仅 el-radio 支持）',
}
```

当前登记的契约（8 条）分两类：

1. **承载位置差异**：栅格 `colHeight`（本平台通过可继承的 CSS 变量下传为逐列 `height`，与参考语义一致）、按钮 `displayStyle`
   （无 static-content-wrapper 外壳）、静态文本 `preWrap`（用 `white-space` 而非 `<pre>`）、
   富文本 `disabled`/`placeholder`（自研 contenteditable）。
2. **上游 UI 库差异**（Element UI 2.x → Element Plus）：`radio-button`/`checkbox-button` 的 `border`
   已移除、按钮图标用 `icon` 而非 class。

> `onCreated` / `onMounted` / `onValidate` 不再登记为宽免：它们已按参考实现补齐为
> `control: 'code'` 的事件类 `propConfig`，在「事件设置」里可见可编辑。

`WAIVERS` 是**契约**而不是垃圾桶：登记一条就等于承认"这里和参考不同且我们知道原因"，
新差异会因为测试失败而被拦住。

## 五、已知局限

- **UI 绑定是"存在性"检查**：只验证属性是否绑定在该标签上，不校验绑定表达式是否语义正确
  （表达式常有 computed 中转）。语义正确性由渲染类用例覆盖（见下）。
- **参考侧模板解析基于正则**，对本项目（Vue 2 单文件组件）足够；参考实现若大改模板写法需要同步调整解析器。
- 只覆盖 `widgetsConfig.js` 里注册的组件；参考的 `extension/samples/*`（扩展示例）不在范围内。

## 六、配套的运行期验收

静态比对保证"该声明的都声明了、该绑的绑了"，运行期行为另有三层用例：

- `packages/materials/src/manifest.test.ts` —— 清单完整性（控件类型合法、联动依赖存在、`defaultChildren` 引用有效等）
- 无头 Chrome 用例：**30 个组件逐个插入画布并渲染成功**、结构编辑器、拖拽交互、代码生成
- 组件 `defineProps` ↔ 清单属性一致性（见上文自检）

两层合起来，才能既保证"抄全了"，也保证"抄对了"。

## 七、本次审计直接查出的真实缺陷（示例）

用它跑第一遍就发现了人工复核很容易漏掉的问题：

1. **18 个字段组件的 `labelIconClass` / `labelIconPosition` / `labelTooltip` 是死配置** ——
   清单声明了、组件没声明也没透传给 `FormItem`，面板改了没有任何效果。已修复。
2. **5 个组件挂着不存在的 `size` 属性**（switch / rate / 图片上传 / 文件上传 / 富文本）——
   参考实现里这些组件根本没有 size，是我们从 `fieldAdvancedProps()` 里被顺带塞进去的。已移除。
3. **按钮丢了 `onClick` 事件声明** —— 组件有 `emit('click')`，清单却没有事件入口，面板里点不出事件编辑器。已补。
4. 参考把内部结构（`tab-pane` 等）渲染在父模板里，我们拆成子组件承载 ——
   审计据此调整为按「组件闭包」检查绑定，避免误报。

## 八、上游样式差异审计（2026 新增）

前面几节覆盖的是"**声明面**"：属性、事件、UI 绑定是否存在。但线上最难查的一类是
**上游 CSS 语义变化被静默吞掉**——它不体现在任何声明里，却能让你已经绑好的属性完全失效。

典型例子（真修过的一个）：

```css
/* Element UI (参考实现)   */ .el-radio-group { display: inline-block }
/* Element Plus (本仓库)   */ .el-radio-group { display: inline-flex }
```

容器变成 flex 后，它的子项成了 flex item，子项的 `display` 会按 CSS 规范被**「块化」**
（`inline` → `block`）。于是绑在选项上的 `displayStyle` **完全失去作用**：
属性面板里从 `inline` 切到 `block`，画布上三个选项依旧挤在同一行。

这类问题**现有的三层验证都抓不到**：

| 层 | 为什么漏 |
| --- | --- |
| 静态审计（第二~五节） | 只看"属性是否绑定"，不看"上游 CSS 是否还认这个属性" |
| happy-dom 单测 | **没有布局引擎**，`getComputedStyle` 不反映真实 flex 布局 |
| 单测断言 inline style | 断言的字符串本身是对的，失效发生在布局阶段 |

### 怎么跑

```bash
pnpm --filter @lowcode/materials test    # 审计是其中一个用例
```

产物：

- `docs/upstream-diff-report.md` —— 人读（自动生成，勿手改）
- `docs/upstream-diff-report.json` —— 机器可读

参考实现不存在时自动跳过（`describe.skipIf`），不影响 CI。

### 比对了什么

把两份 CSS 的**布局关键属性**（`display` / `position` / `z-index` / `overflow*` /
`flex-direction` / `align-items` / `justify-content` / `float` / `vertical-align`）
按选择器逐一 diff，再与**本仓库物料实际用到的组件**求交集（`ElInput` → `.el-input`，
含子元素 `.el-input-group__append` 这类）。

比对前会**求值 CSS 自定义属性与 `calc()`**：Element Plus 大量用
`calc(var(--el-index-top) + 1)` 表达层级，而 Element UI 写字面量——
不求值会把 `.el-select-dropdown` 这类"两边都是 1001"误报成差异（实测修正前 5 条误报 → 修正后 1 条）。

### 两级判定（关键设计）

"上游把某元素的 `display` 改成 `flex`"**本身不是 bug**，
必须叠加"**我们在它的子项上绑了 `display`**"才成立。因此分两层：

| 层 | 处理 |
| --- | --- |
| ⛔ **会让我们失效** | 命中 `CRITICAL_CONTAINERS`（手工登记：我们在其子项上绑 display 的容器）的语义变化，**测试强制拦截**，必须修或登记 `CSS_WAIVERS` |
| 🔴 其余语义变化 | 只进报告供人工判断，多半与我们无关 |

这样既不会漏掉真正会坏的，也不会被十几条「上游改了 display」淹掉。

报告还带一个 **「已复核结论」** 区：把每条差异的裁决（已修 / 不适用 / 未使用）写进去，
并在表格里用 `⛔ / ✅ / ⬜` 标状态。**未复核条目会被计数**，避免出现
「报告里那一堆 🔴 到底看没看过」的模糊状态。当前 18 条非前缀差异**全部已复核**。

### 已知局限

- 只比对**两边都有**的选择器；Element Plus **新增**的规则不在范围内
  （新增通常表现为"多了一层 wrapper"，只能真机看）。
- 解析器不处理 `@media` 嵌套：媒体查询里的覆盖值会参与比对，可能误报。
- `CRITICAL_CONTAINERS` 是手工登记的——**新增"在子项上绑 display"的组件时必须同步登记**，
  否则该组件不会被拦截。
- 只覆盖布局属性，颜色/圆角/字号等视觉细节不在范围。

### 逐条的真机复核

报告只负责"列出嫌疑"。确认某条到底有没有影响，用真实浏览器：

```bash
node scripts/cdp-inspect.mjs --url http://localhost:5174/ --wait ".lc-canvas" \
  --eval "getComputedStyle(document.querySelector('.el-radio')).display"
```

方法与已有结论见 [`docs/interaction-spec/README.md`](interaction-spec/README.md) 7.8。
