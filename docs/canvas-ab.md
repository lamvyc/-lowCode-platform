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

## 七、这一层还能往下做

| 方向 | 说明 |
| --- | --- |
| 追平那 10px 宽度链 | 目前是唯一"命中全部 24 个物料"的根因 |
| `el-range-input` 宽度 352 vs 137 | 时间范围 / 日期范围，差异最大的一条（差 2.5 倍） |
| `el-rating__item` / `el-switch__core` 的 display | 这两处 display 差异**疑似我们自己写的覆盖**，不是上游造成的，需要看源码 |
| `realDrag` 支持 scrollIntoView | 解决富文本 / 级联选择 / 提示 取不到数的问题 |
| 把 `height`/`width` 纳入上游样式审计 | ⚠️ 本轮发现 `el-switch` 高 20→32 这类上游变更时，才意识到审计的属性列表里**没有 `height`/`width`**（当时为降噪排除了）。建议只比对"两边都是固定 px 且不同"的情形，避免噪音 |
| 属性面板 A/B | 每个组件的可配置项是否与参考一致（第三个尚未对比的层） |
| 设备切换栏对齐 | 把 PC/Pad/H5 切到中栏画布上方，与参考同构 |
