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

## 六、这一层还能往下做

| 方向 | 说明 |
| --- | --- |
| 逐物料跑 A/B | 本轮只跑了「单行输入」。把 `scripts/canvas-ab.py` 的物料列表扩到全部 27 个，就能一次列出所有组件的渲染偏差 |
| 属性面板 A/B | 每个组件的可配置项是否与参考一致（第三个尚未对比的层） |
| 设备切换栏对齐 | 把 PC/Pad/H5 切到中栏画布上方，与参考同构 |
