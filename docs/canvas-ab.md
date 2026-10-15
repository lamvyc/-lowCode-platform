# 画布级 A/B 对比（参考实现 vs 本仓库）

> 实测得出，不是读代码推测。工具：`scripts/canvas-ab.py`。方法见文末。

## 为什么需要这一层

已有的三层验证都看不到"**画布上真正渲染成什么样**"：

| 层 | 覆盖 | 看不到 |
| --- | --- | --- |
| 静态一致性审计 | props / events / 绑定 | 渲染结果 |
| 上游样式审计 | 上游 CSS 语义变化 | 我们自己的布局 |
| 组件级单测（happy-dom） | DOM 行为 | **没有布局引擎** |
| 真机验收套件 | 我们自己相对自身的回归 | **没有参照物** |

而"感觉不一样"恰恰全在这一层。实测一次就查出了**一整套系统性偏差**。

## 前置

```bash
# 参考实现（Vue 2 + webpack 4，Node 24 下可直接跑；沙箱需一次性放宽）
cd /Users/unravel/variant-form
NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service serve --port 8090

# 本仓库
pnpm dev
```

两边都用 **1600×900** 视口。参考用 `vuedraggable`（鼠标事件驱动），本仓库用 HTML5 DnD——
同一个真实鼠标手势（press → 多次 move → release）**两边都能驱动**。
物料标签已与参考对齐，因此**同一个 `[title="单行输入"]` 选择器对两边都有效**。

```bash
python3 scripts/canvas-ab.py
```

## 一、骨架级（三栏布局）

### 修复前

| | 参考 | 本仓库 | 差 |
| --- | --- | --- | --- |
| body 原点 | (0,0) | **(8,8)** | 浏览器默认 `body { margin: 8px }` 没重置 |
| body 宽 | 1600 | **1584** | 少 16 |
| header | 1600×**48** | 1584×**49** | content-box + 1px 边框 |
| 左栏 | 260×852 | **261**×851 | 同上 |
| 中栏（画布） | **1040**×852 | **1022**×851 | 净少 **18** |
| 右栏 | 300×852 | **301**×851 | 同上 |

中栏少 18px，意味着**画布上所有东西的可用宽度都不对**——下游任何测量都失去可比性。

### 修复后

| | 参考 | 本仓库 |
| --- | --- | --- |
| body | 1600×900 @(0,0) | **1600×900 @(0,0)** ✅ |
| header | 1600×48 @(0,0) | **1600×48 @(0,0)** ✅ |
| 左栏 | 260×852 @(0,48) | **260×852 @(0,48)** ✅ |
| 中栏 | 1040×852 @(260,48) | **1040×852 @(260,48)** ✅ |
| 右栏 | 300×852 @(1300,48) | **300×852 @(1300,48)** ✅ |

**逐像素一致。**

### 骨架修复内容

| 位置 | 改动 |
| --- | --- |
| `packages/playground/src/global.css`（新增） | `html, body { margin: 0; padding: 0 }`。⚠️ **不加全局 `box-sizing: border-box`**：设计器里有依赖 content-box 的尺寸计算，一次性改会大面积回归 |
| `Toolbar.vue` | `box-sizing: border-box`（48px 含 1px 边框） |
| `MaterialPanel.vue` / `PropsPanel.vue` | `box-sizing: border-box`（260 / 300 含边框） |

## 二、画布结构

| | 参考 | 本仓库（修复前） | 本仓库（修复后） |
| --- | --- | --- | --- |
| 画布底色 | `#f1f2f3`（灰） | `#fff` | `#f1f2f3` ✅ |
| 画布内边距 | 10px | 24px | 10px ✅ |
| 白色"表单面" | `.widget-form`（白底 + 3px 内边距 + **撑满高度**） | 无（透明） | `.lc-runtime-root` 承担 ✅ |
| 表单净宽 | **1016** | 992 | **1020**（差 4px） |

参考的层级是：灰底画布 → 10px → 白色表单面 → 3px → 内容。我们此前是一层白底 + 24px。

## 三、组件级：单个「单行输入」的实测对比

### 修复前

| 项 | 参考 | 本仓库 |
| --- | --- | --- |
| label 位置 | **在左** | **在上（整行 992px）** |
| label 宽 | 80px | 992px |
| label 高 / 行高 | 36px / 36px | 24px / 22px |
| label 字号 | 14px | 13px |
| label 颜色 | `rgb(96,98,102)` | `rgb(78,89,105)` |
| label padding | `0 12px 0 0` | `0 0 2px 0` |
| 条目高 | 36px | 56px |
| 条目 `margin-bottom` | **22px** | **0** |
| 控件高 | **36px** | 32px |
| 控件宽 | 924px | 992px |
| 默认标签 | `input` | **`input225556`** |

### 修复后

上面**除控件宽（差 10px，源自表单净宽的 4px 差）外全部一致** ✅

### 根因与修复

参考实现的默认表单配置（`variant-form/src/utils/util.js: getDefaultFormConfig()`）：

```js
labelWidth: 80,  labelPosition: 'left',  size: '',   // '' 在运行时按 medium（36px）处理
```

| 改动 | 位置 |
| --- | --- |
| `labelPosition` `top` → **`left`**、`labelWidth` `100` → **`80`** | `packages/schema/src/form-settings.ts` |
| 条目 `margin-bottom: 22px`；label 字号 14 / 行高 36 / padding-right 12 / 颜色 `#606266` | `FormItem.vue` |
| 控件高 36px：`--el-component-size: 36px`（EP 无 36px 档位，直接给变量） | `FormItem.vue` |
| demo schema 里显式写的 `labelPosition: 'top'` / `labelWidth: 100` 改为参考默认；去掉自定义 CSS 里的 `max-width: 960px`（把 demo 收窄了，失去可比性） | `packages/playground/src/demo-schema.ts` |
| 默认标签 `label = name` → **`label = label \|\| type.toLowerCase()`** | `packages/editor/src/engine/editor-engine.ts` |

参考的 label 规则（`designer.js: copyNewFieldWidget()`）：

```js
newWidget.options.name  = newWidget.id                                  // type + tempId
newWidget.options.label = newWidget.options.label || newWidget.type.toLowerCase()
```

实测参考的属性面板：`name=input23761`、**`label=input`**。

## 四、剩余差异（分级）

### 固有：Element UI → Element Plus 的结构差异

| 项 | 参考 (EU) | 本仓库 (EP) | 说明 |
| --- | --- | --- | --- |
| `.el-input` display | `inline-block` | `inline-flex` | 上游变更，已登记在 `upstream-diff-report.md` |
| `.el-input__inner` border/padding/border-radius/背景 | 在 input 自身 | 在 `.el-input__wrapper` 上 | **EP 多了一层 wrapper**——上游审计明确声明覆盖不到这类"新增结构" |
| `.el-input__inner` 高 | 36px | 34px | EP 的 wrapper 占掉上下各 1px 边框 |

这三条**无法在不改 Element Plus 的前提下消除**，属于可接受的移植代价。

### 待处理

| 项 | 参考 | 本仓库 | 说明 |
| --- | --- | --- | --- |
| 表单净宽 | 1016 | 1020 | 参考的 `.el-main` 比其父容器窄 4px（疑为滚动条占位），未追到底 |
| 设备切换栏位置 | 在中栏画布**上方**（占 44px 高，所以表单高 788） | 在**顶部工具栏**里（表单高 832） | 真实的结构差异，本轮未改 |

## 五、⚠️ 一个测试断言的其实是错误行为

改动 `label` 兜底规则后，这条测试变红了：

```
EditorEngine > insertMaterial 生成唯一 name 且 label 初始等于 name
  AssertionError: expected 'card' to be 'card330163'
```

**是测试错了，不是代码错了。** 它把 `label === name`（即 `card330163` 这种带随机后缀的标签）
固化成了"期望行为"，而参考实现给的是 `type.toLowerCase()`（`card`）。

已改名为 `insertMaterial 生成唯一 name；label 兜底成类型名（不是 name）`，
并在注释里写明参考的规则与实测证据。

> 这正是本项目最初那个问题的缩影：**测试全绿 ≠ 行为正确**。
> 当测试的期望值来自"当前实现"而不是"参考实现"时，它守的是 bug。

## 六、全量扫描：27 个物料一次跑完

```bash
python3 scripts/canvas-ab-all.py          # 全部物料
python3 scripts/canvas-ab-all.py 单行输入 开关  # 只跑指定物料
```

**结果：完全一致 0 / 有差异 24 / 未取到 3。**

但**不要把"24 个物料有差异"读成 24 个独立问题**——按根因聚合后只有 8 条，其中
前两条就占了绝大多数条目：

| # | 根因 | 命中物料 | 实测值 | 判断 |
| --- | --- | --- | --- | --- |
| 1 | **容器宽度差 10px** | **24**（全部） | `924 vs 934`×18、`1004 vs 1014`×16、`1016 vs 1014`×8 | 见下"宽度链" |
| 2 | `content` 的 `margin-left` | 15 | 参考 `0 0 0 80px` vs 我们 `0` | **机制不同、效果等价**：EU 用 label 浮动 + content 左外边距；我们用 flex。属误报，不需改 |
| 3 | `display` 上游差异 | 11 | `block→flex`×9、`inline-block→inline-flex`×7、`inline-block→block`×8 | 多数是 EU→EP 结构差异；**少数是我们自己的覆盖**（评分 `el-rate__item`、开关 `el-switch__core`） |
| 4 | 尺寸档位差 | 15 | `h 36 vs 32`×4 | EP 没有 36px 档位（我们已用 CSS 变量补了主控件，子元素未覆盖） |
| 5 | `el-divider__text` 高 | 10 | `17 vs 20`、`height 16px vs 14px` | 行高/字号差 |
| 6 | **`el-range-input` 宽** | 4 | 参考 **352** vs 我们 **137** | **真实的大差异**——时间/日期范围的输入框宽度 |
| 7 | `padding-left` | 6 | 参考 `10px` vs 我们 `8px` | 内边距 2px |
| 8 | `el-switch` 高 | 1 | 参考 **20px** vs 我们 **32px** | **上游变更**：EU `.el-switch{height:20px}`，EP `{height:32px}` |

### 本轮已修（都是"一处修复、多个物料同时变好"）

| 修复 | 命中物料数 |
| --- | --- |
| 表单基线字号 **16px → 14px** | **17**（`content.fontSize` 一条在所有物料上同时消失） |
| 素描排除编辑器自身浮层（`lc-node__*`） | 测量污染，影响容器类物料的差异计数 |
| 分隔线 `margin` **`24px 0` → `0`** | 1（但值差 48px，肉眼可见） |

分隔线那条的来源值得记：**参考实现是在它的两个包裹层里用 scoped 规则
`.el-divider--horizontal { margin: 0 }` 压掉 Element 默认的 `margin: 24px 0`**
（`form-item-wrapper.vue` / `static-content-wrapper.vue`）。EC 的默认值两边其实一样，
差异完全来自参考的**包裹层覆盖**——只看 CSS diff 是找不到的。

### ⚠️ 未取到 3 个：富文本 / 级联选择 / 提示

这三个在物料面板里靠下，**面板需要滚动才能看到**，`centerOf` 取到的坐标落在可视区外，
拖拽起点无效。属工具限制，下一轮给 `realDrag` 加"先 scrollIntoView"。

### 顺带修掉的工具缺陷：CDP 端口固定 9222

第一次扫全量时，我并发跑了一个只读探针，**它静默连上了后台扫描的同一个 Chrome**
（`--remote-debugging-port` 默认 9222，端口是进程级独占的），两边互相污染页面状态。
已改为**不显式指定端口时用 `--remote-debugging-port=0` + 读 `DevToolsActivePort`**，
让 Chrome 自己挑空闲端口。并发验证：两个实例各自拿到正确页面，互不干扰。

> 这类缺陷很阴险：脚本"看起来正常"，结果却不可信。任何固定端口/固定路径的并发使用都要警惕。

### 宽度链：那 10px 从哪来

| | 参考 | 本仓库 |
| --- | --- | --- |
| 中栏（`.center-layout-container` / `.lc-canvas`） | 1040 | 1040 ✅ |
| 画布内容 | `.el-main` **1036** | `.lc-canvas` 内容 **1020**（padding 10×2） |
| 表单/白色面 | `.widget-form` **1016** | `.lc-runtime-root` **1020** |
| 表单项 | `.el-form-item` **1004** | `.lc-form-item` **1014** |

参考的 `.el-main` 比父容器窄 4px（疑为滚动条占位），且表单自身 padding 3px×2，
所以表单 1016 < 画布内容 1036；而我们表单就是画布内容（1020）。
两端各差几个像素、累积到表单项上是 **10px（约 1%）**。

## 七、给 A/B 降噪（第二轮）

第一版报告里混着**已知的假差异**，每读一次都要在脑子里过滤一遍。降噪做了三件事，
**结果差异数反而上升（24 → 27 个物料）——因为测量变准了**，见下文。

### 1. 比较层级：统一到「节点包裹层」

参考的节点包裹层是 `.field-wrapper`（1004），它外面还有一层 `.form-widget-list`（1010）。
第一版误用了后者，于是差异显示成 `1010 vs 1014`，看起来像 "+4"，
但真正的节点级差异是 `1004 vs 1014`。

**层级选错会把根因拆成两半**，必须与我们对齐到同一级（我们那边是 `[data-node-id]`）。

### 2. 类名过滤：只保留 `el-*` + 登记过的别名

我们自己的根类（`lc-card` / `lc-static-text` / `lc-divider` …）参考没有对应物，
全收进来会把"我们的组件多了个根类"报成结构差异——静态文字因此曾报成
「控件 0 vs 1」（参考那个组件是**纯 div**，压根没有 `el-` 元素）。

只保留 `el-*`，外加明确登记过的别名（`lc-form-item*` → `el-form-item*`）。

### 3. 编辑器浮层：按**子树**排除

参考的 `.field-action`（操作条）/ `.drag-handler`（拖拽手柄），
我们的 `.lc-node__badges` / `.lc-node__actions`。

⚠️ 只过滤元素自身不够——里面的 `el-icon-*` 会漏进来，
让容器类物料的"控件结构"看起来差很多（静态文字曾报成 `el-icon-back → el-icon-delete → …`）。
必须整棵子树跳过。

### 4. `realDrag` 先 `scrollIntoView`

富文本 / 级联选择 / 提示 在面板里靠下，900px 视口里不可见，
`getBoundingClientRect` 拿到视口外坐标 → 拖拽起点无效 → 报"画布未生效"。
现在拖拽前先把源滚进视口。**27/27 全部可测**（此前 24/27）。

### 5. 已知机制差异单列，不计入差异数

| 项 | 说明 |
| --- | --- |
| `el-form-item__content.margin` | EU：label 浮动 + content 用 `margin-left` 让出宽度；我们：flex。参考 `0 0 0 80px`、我们 `0`，但 content 左边界一致 |
| 节点包裹层 `.margin` | 参考把间距放在 `.field-wrapper`（含 `design-time-bottom-margin`），我们放在 `.lc-form-item`。同一件事、不同层 |

单列而不是静默丢弃——报告里仍看得见，只是不污染计数。

---

## ⚠️ 降噪过程中揪出的两个真缺陷

### 缺陷 A：比较器会**静默吞掉属性差异**（严重）

`diff_controls` 里原本有一行：

```python
if a['el'] != b['el']:
    continue          # 类名不同 → 跳过这个元素的**全部属性比较**
```

只要类名不完全相同就跳过。于是当我们的元素多了个修饰类
（如 `el-divider.el-divider--horizontal.lc-divider`）时，
它的 `margin` / `height` 差异**根本没被检查过**，报告显示"没问题"。

**这正是我上一轮误判「分隔线已修好」的原因。**

修法：只在**块名**（第一个 `el-` 类）都不同时才认为不是同一元素；
仅修饰类不同时照常比较属性，并把修饰类差异单独报出来
（这条本身也是有价值的信号——例如参考有 `el-cascader--medium`，
我们用 CSS 变量所以没这个类）。

> **教训**：比较器里任何"跳过"分支都要问一句——
> 它跳过的到底是"不适用"，还是"我没能力比较"？后者必须转成显式报告。

### 缺陷 B：分隔线的 `:deep()` 后代选择器从未匹配

```css
/* 我写的（错） */
.lc-divider :deep(.el-divider--horizontal) { margin: 0 }
```

`:deep(A B)` 编译成**后代**选择器：

```
.lc-divider[data-v-a857cc2c] .el-divider--horizontal     ← 匹配不到任何元素
```

而 `lc-divider` 与 `el-divider--horizontal` 是**同一个元素**上的两个类。

```html
<div class="el-divider el-divider--horizontal lc-divider">
```

正确写法是复合选择器（特异性 (0,3,0)，稳过 Element 的 (0,1,0)）：

```css
.lc-divider.el-divider--horizontal { margin: 0 }
```

> 结合缺陷 A：这条 CSS 从未生效，而比较器又把它的差异吞掉了——
> **两个缺陷叠在一起，让一个坏掉的修复看起来是好的。**

---

## 八、修正后的数据（27/27 可测）

| 属性 | 命中物料 | 主要值 |
| --- | --- | --- |
| **`w`** | **27（全部）** | `924→934`×30、`1004→1014`×25 |
| `h` / `height` | 19 | `17→20`×10、`36→32`×7、`16→14`×6 |
| `display` | 18 | `block→flex`×14、`inline-block→inline-flex`×11、`inline-block→block`×8 |
| 结构 / 修饰类 | 23 | 含 `el-cascader--medium` 这类上游档位类 |
| `padding` | 8 | `…10px→…8px`×6 |
| `fontSize` | 4 | `14→13`×2、`12→14`×2 |
| `margin` | 3 | — |
| `borderRadius` | 1 | `3px→4px` |

**主根因仍是 `w` 的那 10px，命中全部 27 个物料**——它是下一步优先项。

## 九、追平那 10px（第二轮）

**+4 的来源**：参考的中栏有分隔边框。

```
.center-layout-container { border-left: 2px dotted #EBEEF5; border-right: 2px dotted #EBEEF5 }
```

它是 `border-box`，所以内容宽从 1040 压到 **1036**。我们对应层没有边框 → 1040。

**+6 的来源**：参考有**两层 3px 内边距**，我们只有一层。

```
参考：.widget-form(padding 3) → .form-widget-list(padding 3) → .field-wrapper
我们：.lc-runtime-root(padding 3) → [data-node-id]
```

从画布边到节点，参考是 `10 + 3 + 3 = 16px`，我们是 `10 + 3 = 13px`。

### 修法

| 改动 | 位置 |
| --- | --- |
| 补两侧 2px 点线分隔边框 | `.lc-canvas-wrap--pc`（border-box，等量吃掉 4px） |
| 内边距 3px → **6px** | `.lc-canvas--pc :deep(.lc-runtime-root)` |

第二处用 6px 而不是再加一层 DOM：参考那两层合起来是 6px，
**白面到节点的距离因此完全一致**。参考 `.widget-form` 1016 → 3px → 列表 1010 → 3px → 节点 1004；
我们 `.lc-runtime-root` 1016 → 6px → 节点 1004。**白面尺寸与节点尺寸都对齐。**

### 效果

| | 修复前 | 修复后 |
| --- | --- | --- |
| 节点包裹层宽 | 1014 | **1004**（= 参考） |
| 画布容器宽 | 1040 | **1036**（= 参考） |
| `w` 命中物料数 | **27（全部）** | **14** |
| 完全一致的物料 | 0 | **2**（静态文字、HTML） |

差异数全线下降（颜色选择器 20→18、计数器 19→15、时间范围 16→14、单选项 31→29…）。

**残余的 `w` 差异已全是组件级**，不再是系统性噪声：

| 值 | 命中 | 说明 |
| --- | --- | --- |
| `352 → 137` | 4 | `el-range-input`：时间范围 / 日期范围，差 2.5 倍，最大的一条 |
| `1016 → 1004` | 4 | 个别物料的内层容器 |
| `998 → 1002` | 3 | 标签页内层 |

## 十、逐物料清零（第三轮，进行中）

### 已完成：时间范围 / 日期范围（14 → 3）

差得最狠的一个组件：**整个范围编辑器只有 370px，参考是 924px**；里面的输入框 137 vs 352（差 2.5 倍）。

根因有三层，**每一层都值得单独记**：

| # | 现象 | 根因 |
| --- | --- | --- |
| 1 | `width: 100%` 写在 scoped 样式里，完全没生效 | **该元素上没有 scope 属性**：`ElTimePicker` / `ElDatePicker` 不是组件模板的根（根是 `FormItem`），它们在 `FormItem` 的插槽里，Vue 不给它们加 `data-v-*`。实测该元素属性只有 `["class","tabindex"]`，`matches('.lc-time-range[data-v-x]')` 为 **false**。（`Divider.vue` 能用 scoped 是因为 `ElDivider` 是它模板的根。） |
| 2 | 改用变量覆盖 `--el-date-editor-width: 100%` 仍不生效 | EP 的宽度是变量驱动的：`.el-date-editor.el-input__wrapper { width: var(--el-date-editor-width) }` 是 **(0,2,0)**，与我们的规则**特异性相同**，靠源码顺序决胜负——我们输。 |
| 3 | 内联样式生效后，宽度 944 还是比参考的 924 宽 20px | `.el-input__wrapper` 是 `content-box`，`width:100%` 之外还要再加 `padding: 10px ×2`。要一起给 `box-sizing: border-box`。 |

过程中还查出两处**上游变更**（都已对齐）：

| 元素 | Element UI | Element Plus |
| --- | --- | --- |
| `.el-range-separator` | `width: 5%`（5% × 904 = **45.2px**，正合参考实测的内容宽 45.09px） | 去掉了 width、改成 **`flex: 1`**（撑满剩余空间，实测 171px，参考 55px） |
| `.el-range-input` | 无固定高（medium 下 28px） | 写死 `height/line-height: 30px` |

**最终：14 → 3 处**（剩 1px 舍入 + 一条结构串差异）。

### 顺带修掉的工具问题

- 比较器遇到「仅修饰类不同」时不再跳过属性比较（见第七节缺陷 A）
- **上游档位类**（`--medium` / `--mini`）归入已知差异：Element UI 有 medium/small/mini 三档类，
  Element Plus 只有 large/default/small，我们用 CSS 变量模拟 medium 的度量，
  因此不会出现 `--medium` 类，**但尺寸是对的**。结构比较也会先把这些类剔掉。

### 剩余清单（按差异数）

| 物料 | 差异 | 主要项 |
| --- | --- | --- |
| 多选项 / 单选项 | 37 / 29 | 选项高 参考 **17** vs 我们 **20**、`height: auto` vs `32px`；group 高 参考 36/41 vs 我们 20/16 |
| 颜色选择器 | 18 | `el-color-picker__trigger` 36 vs 32 |
| 栅格 | 14 | `el-row` / `el-col` 的结构与子元素 |
| 计数器 | 13 | `el-input-number__decrease` 的 `display: block→flex`、尺寸 |
| 提示 | 13 | `el-alert__content` 的 `display: block→flex`、`padding: 0 8px` vs `0` |
| 标签页 | 12 | `el-tabs__header` 的 `display: block→flex`、nav 宽度 |
| 评分 | 12 | `el-rate__item` 的 `display: inline-block→block` |
| 文件 | 9 | `el-upload--text` 64×36 vs 88×32 |

## 十一、这一层还能往下做

| 方向 | 说明 |
| --- | --- |
| 追平那 10px 宽度链 | 目前是唯一"命中全部 24 个物料"的根因 |
| `el-range-input` 宽度 352 vs 137 | 时间范围 / 日期范围，差异最大的一条（差 2.5 倍） |
| `el-rating__item` / `el-switch__core` 的 display | 这两处 display 差异**疑似我们自己写的覆盖**，不是上游造成的，需要看源码 |
| `realDrag` 支持 scrollIntoView | 解决富文本 / 级联选择 / 提示 取不到数的问题 |
| 把 `height`/`width` 纳入上游样式审计 | ⚠️ 本轮发现 `el-switch` 高 20→32 这类上游变更时，才意识到审计的属性列表里**没有 `height`/`width`**（当时为降噪排除了）。建议只比对"两边都是固定 px 且不同"的情形，避免噪音 |
| 属性面板 A/B | 每个组件的可配置项是否与参考一致（第三个尚未对比的层） |
| 设备切换栏对齐 | 把 PC/Pad/H5 切到中栏画布上方，与参考同构 |
