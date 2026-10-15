# 物料面板 A/B 对比（参考实现 vs 本仓库）

> 本文由**实测**得出，不是读代码推测。方法见文末「怎么复现」。
>
> **状态：已修复**（14 个标签、5→4 个分组、图标换 SVG、补「提示」物料）。
> 第二节起是**修复前**的记录，保留作为对照；修复结果与验证见文末「修复结果」。

## 为什么做这个

静态一致性审计（`conformance/audit.ts`）覆盖的是 props / events / UI 绑定，
上游样式审计（`conformance/upstream-css.test.ts`）覆盖 CSS 语义变化。
**两者都看不到"面板本身长什么样、叫什么名字、分在哪个组"** ——
而这恰恰是使用者第一眼看到的东西。

## 怎么拿到 oracle

参考实现 `variant-form` 是 Vue 2 + webpack 4 工程，在 Node 24 上**可以直接跑**：

```bash
cd /Users/unravel/variant-form
NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service serve --port 8090
```

两个坑：

1. Node 24 无 `--openssl-legacy-provider` 时 webpack 4 的哈希会失败
2. ⚠️ 该工程的构建脚本会写自己目录下的 `public/index.html`，**在 DSH 文件沙箱下会被拒**
   （表现为 `EPERM: copyfile 'index_template/index_dev.html' -> 'public/index.html'`）。
   需要一次性放宽到 `danger-full-access` 才能启动。

启动后两个 app 可同时驱动，做真正的 A/B：

| | 地址 | 说明 |
|---|---|---|
| 参考实现 | `http://localhost:8090/` | Vue 2，`#app.__vue__` |
| 本仓库 | `http://localhost:5174/` | Vue 3，`#app.__vue_app__` |

## 参考实现的面板（权威清单）

容器（4）/ 基础字段（18）/ 高级字段（4）/ 自定义扩展字段（1）＝ **27 个物料**。
每项都带一个**命名 SVG 图标**（`svg-icon` + `<use xlink:href="#icon-*">`）。

| 分组 | 物料（图标名） |
| --- | --- |
| 容器 | 栅格 `icon-grid`、表格 `icon-table`、标签页 `icon-tab`、卡片 `icon-card` |
| 基础字段 | 单行输入 `icon-text-field`、多行输入 `icon-textarea-field`、计数器 `icon-number-field`、单选项 `icon-radio-field`、多选项 `icon-checkbox-field`、下拉选项 `icon-select-field`、时间 `icon-time-field`、时间范围 `icon-time-range-field`、日期 `icon-date-field`、日期范围 `icon-date-range-field`、开关 `icon-switch-field`、评分 `icon-rate-field`、颜色选择器 `icon-color-field`、滑块 `icon-slider-field`、静态文字 `icon-static-text`、HTML `icon-html-text`、按钮 `icon-button`、分隔线 `icon-divider` |
| 高级字段 | 图片 `icon-picture-upload-field`、文件 `icon-file-upload-field`、富文本 `icon-rich-editor-field`、级联选择 `icon-cascader-field` |
| 自定义扩展字段 | 提示 `icon-alert` |

DOM 标记：分组是 `.el-collapse.widget-collapse > .el-collapse-item`，
容器组的项是 `li.container-widget-item`，其余组的项是 `li.field-widget-item`，
标签在 `title` 属性上。

## 本仓库的面板

容器组件（4）/ 基础组件（5）/ 表单字段（15）/ 高级字段（3）/ 数据组件（1）＝ **28 个物料**。
图标是 **Unicode 字形**，不是 SVG。

| 分组 | 物料（图标字符） |
| --- | --- |
| 容器组件 | 栅格 `▩`、布局表格 `▦`、标签页 `▤`、卡片 `▢` |
| 基础组件 | 静态文本 `T`、HTML 文本 `❮❯`、按钮 `□`、分割线 `─`、图片 `◫` |
| 表单字段 | 输入框 `▤`、多行文本 `▥`、计数器 `＃`、单选框 `◉`、复选框 `☑`、下拉选择 `▾`、时间选择 `◷`、时间范围 `◷`、日期选择 `▦`、日期范围 `▦`、开关 `◑`、评分 `★`、颜色选择 `◼`、滑块 `⬌`、级联选择 `≫` |
| 高级字段 | 图片上传 `▧`、文件上传 `▨`、富文本 `▤` |
| 数据组件 | 数据表格 `☰` |

## 差异

### 1. 分组结构不同

| 参考 | 本仓库 |
| --- | --- |
| 容器（4） | 容器组件（4） |
| **基础字段（18）** | **基础组件（5）+ 表单字段（15）** ← 拆成了两组 |
| 高级字段（4） | 高级字段（3） |
| **自定义扩展字段（1）** | **无** |
| — | **数据组件（1）** ← 多出来的组 |

### 2. 标签名不一致（14 处）

| 参考 | 本仓库 |
| --- | --- |
| 单行输入 | 输入框 |
| 多行输入 | 多行文本 |
| 单选项 | 单选框 |
| 多选项 | 复选框 |
| 下拉选项 | 下拉选择 |
| 时间 | 时间选择 |
| 日期 | 日期选择 |
| 颜色选择器 | 颜色选择 |
| 静态文字 | 静态文本 |
| HTML | HTML 文本 |
| 分隔线 | 分割线 |
| 图片 | 图片上传 |
| 文件 | 文件上传 |
| 表格 | 布局表格 |

### 3. 图标体系不同

参考用 27 个**命名 SVG sprite**；本仓库用 26 个 Unicode 字形。
字形在不同字体/平台下渲染不一致（`＃` 是全角、`❮❯`/`⬌`/`≫` 字形风格各异），
且**语义可读性差**（`▤` 被同时用在"输入框"和"富文本"上）。

### 4. 物料集合差异

| | 物料 |
| --- | --- |
| 参考有、本仓库没有 | **提示**（alert） |
| 本仓库有、参考没有 | **数据表格**、**图片（展示图片）** |

### 5. `title` 属性语义不同

| | 值 |
| --- | --- |
| 参考 | `title="单行输入"` —— 就是标签本身 |
| 本仓库 | `title="输入框：单行 / 密码 / 多行文本输入"` —— 标签 + 描述 |

## 修复建议（按影响排序）

1. **标签名与分组对齐**（14 个标签 + 5→4 个分组）—— 纯文案与配置，改动小、肉眼可见
2. **图标换成 SVG**：把参考实现的 27 个图标搬过来，或在 `manifest` 里把 `icon` 字段
   从字符改成 svg 名，面板用 `<svg><use/></svg>` 渲染
3. **补「提示」物料**；决定「数据表格」「图片（展示）」是保留（作为本仓库扩展）还是对齐移除
4. **`title` 只放标签**，描述文案另走 tooltip 或属性面板

## 怎么复现

```bash
# 两个 dev server 都要起来（参考 8090 / 本仓库 5174）
node scripts/cdp-inspect.mjs --url http://localhost:8090/ --wait '#app' --eval "$(cat /tmp/…/extract-ref.js)"
node scripts/cdp-inspect.mjs --url http://localhost:5174/ --wait '.lc-canvas' --eval "$(cat /tmp/…/extract-ours.js)"
```

## ⚠️ 抽取时踩过的三个假象（写下来避免后人重踩）

机械抽取很容易把**自己的选择器问题**当成产品问题。本次连续踩了三次：

| 假象 | 真因 |
| --- | --- |
| "本仓库面板没有分组" | 选择器用了 `closest('[class*="group"]')`，先命中了 `.lc-group__items`（没有 header），而不是 `.el-collapse-item` |
| "多出两个空分组（基础设置 / 事件设置）" | 选择器 `aside .el-collapse-item` 把**右侧属性面板**的分组也捞进来了 |
| "分组名是「容器组件4」「基础组件5」" | `textContent` 把标签和**独立的计数徽标** `<span class="lc-group__count">` 拼接了 |

**结论：任何机械抽取的结论，落笔前都要回源码核对一次。** 这三条里前两个会让人去改正确的东西。

---

# 修复结果

## 改了什么

| 项 | 改动 |
| --- | --- |
| 标签名 | 14 处改为参考实现的叫法（输入框→单行输入、单选框→单选项、复选框→多选项、下拉选择→下拉选项、时间选择→时间、日期选择→日期、颜色选择→颜色选择器、静态文本→静态文字、HTML 文本→HTML、分割线→分隔线、图片上传→图片、文件上传→文件、布局表格→表格、多行文本→多行输入） |
| 分组 | `容器组件/基础组件/表单字段/高级字段/数据组件` → `容器/基础字段/高级字段/自定义扩展字段`；级联选择从表单字段移到高级字段 |
| 顺序 | manifest 条目重排，使每个分组内的顺序与参考一致 |
| 图标 | 26 个 Unicode 字形 → 28 个内联 SVG（27 个取自参考的 `src/icons/svg/`，1 个自绘） |
| 新增物料 | **提示**（`alert`，对齐参考的扩展字段示例，默认值逐项照搬 `alertSchema.options`） |
| `title` | 去掉描述文案，只放标签（与参考一致） |

## 实现要点

- `packages/materials/src/icons.ts`：由脚本从参考实现生成，把 `<path>` 内联。
  参考用 `svg-sprite-loader` + `<use xlink:href="#icon-xxx">`；本仓库为避免引入额外构建链，
  直接渲染 `<svg viewBox="0 0 1024 1024">`。图标不写 `fill`，继承 `currentColor`，与参考一致。
- `manifest` 的 `icon` 字段语义变了：从"可直接显示的字符"变成"**图标键**"。

## 验证（修复后实测）

| 分组 | 参考 | 本仓库 | 结果 |
| --- | --- | --- | --- |
| 容器 | 栅格 表格 标签页 卡片 | 栅格 表格 标签页 卡片 | ✅ 完全一致 |
| 基础字段 | 18 项 | 参考的 18 项**顺序完全一致**，末尾多 1 项 | ✅ |
| 高级字段 | 图片 文件 富文本 级联选择 | 图片 文件 富文本 级联选择 | ✅ 完全一致 |
| 自定义扩展字段 | 提示 | 提示（同位置）+ 1 项 | ✅ |

图标：每一项目测都是 SVG ✅　`title`：全部等于标签 ✅

### 有意的差异（登记在案）

| 物料 | 说明 |
| --- | --- |
| 基础字段 › 图片 | 展示图片。参考的「图片」是**上传**（我们叫「图片上传」→ 已改名为「图片」），本项是展示用途，参考无对应物料 |
| 自定义扩展字段 › 数据表格 | 数据源驱动的表格，参考无对应物料 |

两者都**追加在所属分组末尾**，因此参考原有项的位置与顺序完全不变。
登记在 `packages/materials/src/palette.test.ts` 的 `INTENTIONAL_EXTRAS`。

## 防回退

| 层 | 守什么 |
| --- | --- |
| `packages/materials/src/palette.test.ts` | manifest 层：分组名、组内成员与顺序、图标键有效、图标无硬编码 `fill`、统一 1024 视图 |
| `scripts/browser-checks.mjs` → `palette-alignment` | 渲染层：4 个分组、基础字段前 18 项顺序、每项渲染出 SVG、`title` 等于标签 |

反向验证：把「单行输入」改回「输入框」→ `palette.test.ts` 报出分组不一致；
把 `icon` 换成不存在的键 → 报出「不是有效的图标键」。

> 修复过程中套件还抓到我自己的一处失误：改名后 `browser-checks.mjs` 里按文案
> 找物料的辅助函数（`tagMaterial('输入框')`）失效，`drop-at-bottom-appends` 与
> `material-drag-to-top` 立刻变红。已同步并加上警示注释。
