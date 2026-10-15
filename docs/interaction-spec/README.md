# 组件交互设计报告（参考实现 `variant-form`）

> **目的**：把参考实现的行为语义固化成**可执行规格**，让每个组件的实现不再需要回头读参考源码。
>
> **参考实现**：`variant-form`（Vue 2.6 + Element UI 2.x；默认位于仓库同级目录，可用 `VARIANT_FORM_SRC` 覆盖）
> **目标实现**：本仓库 `packages/materials`（Vue 3 + Element Plus）
> **生成方式**：从参考源码逐行提取，非推断。每章末尾附**关键行号索引**便于复核。

---

## 一、为什么需要这份报告

本仓库已有 `docs/conformance.md` 描述的**静态一致性审计**（`packages/materials/src/conformance/`），
它从参考源码抽取每个组件的声明面并与本仓库机器比对。

但该审计**自己文档的第五节就写明了局限**：

> **UI 绑定是"存在性"检查**：只验证属性是否绑定在该标签上，不校验绑定表达式是否语义正确

实测后果：审计报告显示 **28/28 组件完全一致、0 缺失**，本仓库 292 个测试全绿，
但组件行为仍然普遍不对。已确认的一个实例：

| 事实 | 位置 |
|---|---|
| 参考的 select 有 `:default-first-option="allowDefaultFirstOption"`（computed 中转） | `select-widget.vue:11` |
| 本仓库的 Select **完全没有 `defaultFirstOption`**（全仓库 grep 0 命中） | `packages/materials/src/components/Select.vue` |
| 审计结果 | ✅ 完全一致 |

**原因**：静态抽取器只识别 `:attr="...options.X"` 的直连形式，
凡是经过 computed 中转的绑定一律漏检——而参考实现里这种中转很常见。

**这份报告要补的正是"行为面"**：数据流、事件顺序、校验时机、状态语义、公开 API、以及源码注释里的取舍。

---

## 二、怎么用

### 2.1 实现某个组件前的固定流程

1. 先读 [`00-通用字段行为规范.md`](./00-通用字段行为规范.md)（**必读**，覆盖所有字段组件 60–70% 的行为）
2. 再读该组件自己的章节
3. 按章节末尾的 **「验收标准」** 逐条实现并勾选
4. 遇到"与本仓库现状的差距"一节列出的条目，**逐条判断是修还是登记为有意偏离**
5. 有意偏离登记到 `packages/materials/src/conformance/audit.ts` 的 `WAIVERS`，必须写明原因

### 2.2 验收标准的用法

每个组件章节最后一节的复选框清单是**故意写成可断言语句**的，可以直接转成测试用例
（`packages/materials/src/**/*.test.ts`）。建议：

- 组件实现完成后，**先**把这些断言写成测试，**再**开始改组件
- 这样可以避免"改完自测通过、实际和参考不一致"

### 2.3 ⚠️ 不要用这份报告替代真实参考

报告是**提炼**，不是替代。当出现以下情况时必须回查参考源码：

- 报告里的描述与你的实际观察不符
- 涉及本报告未覆盖的组件
- 报告标注为"**需核实**"的条目

每章末尾的**关键行号索引**就是为回查准备的。

---

## 三、报告结构约定

每章统一按以下 10 节组织：

| 节 | 内容 | 为什么重要 |
|---|---|---|
| 一、组件身份 | `type` / 图标 / 分组 / `formItemFlag` / 是否选项类 | 物料清单注册的依据 |
| 二、设计态行为 | 初始 schema（**完整 options**）、属性面板逐项、设计态交互 | 属性面板抄漏的直接来源 |
| 三、运行态行为 | 模板绑定逐项、事件映射、数据形态、选项类通道 | 行为差异的主要来源 |
| 四、校验语义 | 该组件特有的校验时机与陷阱 | 点选类组件最容易做错 |
| 五、状态语义 | disabled / hidden / readonly 等的具体表现 | |
| 六、公开 API | 该组件上 `fieldMixin` 各 API 的实际行为 | |
| 七、⚠️ 已知坑 | 逐条编号的雷区清单 | **全篇最值钱的部分** |
| 八、Element UI → Element Plus 差异 | 上游库变更导致的必须改动 | 迁移的核心工作 |
| 九、与本仓库现状的差距 | 对照 `packages/materials` 的实际差异 + 优先级 | 施工清单 |
| 十、验收标准 | 可勾选断言 | 直接当测试用例 |

### 标记约定

| 标记 | 含义 |
|---|---|
| ⚠️ | 易错点 / 与直觉相反的实现 / 文档与代码矛盾处 |
| **源码注释原文** | 参考实现作者留下的考古知识，**必须照搬** |
| **需核实** | 本报告未完全确认，实现前需回查 |
| **信息性** | 记录差异但不建议改动 |

---

## 四、当前进度

| 章节 | 状态 | 说明 |
|---|---|---|
| [00 · 通用字段行为规范](./00-通用字段行为规范.md) | ✅ 完成 | 覆盖共性层全部行为 |
| [input · 单行文本输入](./input.md) | ✅ 完成 | 纯文本类原型 |
| [select · 下拉选择](./select.md) | ✅ 完成 | 选项类原型 |
| [radio · 单选组](./radio.md) | ✅ 完成 | 布尔/点选类原型 |

### 尚未覆盖

| 分组 | 组件 |
|---|---|
| 基础字段（余下） | `textarea`、`number`、`checkbox`、`time`、`time-range`、`date`、`date-range`、`switch`、`rate`、`color`、`slider`、`static-text`、`html-text`、`button`、`divider` |
| 高级字段 | `picture-upload`、`file-upload`、`rich-editor`、`cascader` |
| 容器字段 | `grid`、`grid-col`、`tab`、`tab-pane`、`table`、`table-cell`、`sub-form` |
| 设计器交互 | 拖拽落点、复制/删除、撤销重做、结构编辑、页面模板、代码生成、设备切换 |

> 容器字段与设计器交互是独立的大块，需要各自单独成章。

---

## 五、为什么先做这三个组件

`input` / `select` / `radio` 覆盖了字段组件的**三种原型**，其余组件基本是变体：

| 原型 | 代表 | 特征 | 变体 |
|---|---|---|---|
| 纯输入类 | `input` | 只有 `input` + `change`，无选项通道 | `textarea`、`number`、`color`、`slider` |
| 选项类 | `select` | 有 `optionItems` + `initOptionItems` + `optionData` 通道 | `radio`、`checkbox`、`cascader` |
| 点选类 | `radio` | 选项类，但只有 `change`，无 `input` | `checkbox`、`switch`、`rate` |

另外这三种原型把**三种默认值形态**都覆盖了：

| 组件 | `defaultValue` 初始值 | 体现的形态 |
|---|---|---|
| `input` | `''` | 标量字符串 |
| `select` | `''` | 标量（多选时变数组） |
| `radio` | `null` | 可空标量（且 `resetDefault` 会变成 `''`） |

---

## 六、请反馈：报告够不够用

**这一批（批 0）的目的是验证报告格式**，不是把 28 个组件一次做完。
在你按这三份报告实现完成后，请反馈以下问题——后续批次的格式会据此调整：

1. **信息缺失**：实现时有没有遇到"报告里没说、必须回去查参考源码"的情况？具体是哪一条？
2. **深度不足**：哪些章节描述得太粗（例如属性面板的控件类型/联动条件）？
3. **深度过剩**：哪些内容其实用不上，可以砍掉以降低后续批次的成本？
4. **"验收标准"是否可直接转成测试**：有没有写得不便断言的条目？
5. **"与本仓库现状的差距"是否准确**：有没有误判（把有意偏离当成缺陷，或反之）？
6. **需要新增的章节吗**：例如"代码生成输出的 schema 长什么样"、"导入导出兼容性"？

### 已知需要复核的条目

以下是本批报告中**明确标记为不确定**的点，实现前请一并确认：

| # | 位置 | 待核实内容 | 状态 |
|---|---|---|---|
| 1 | [radio.md](./radio.md) 第八、九章 | Element Plus 的 `el-radio-button` 是否仍支持 `border` | ✅ **已核实：确实不支持**（`RadioButtonProps` 不含 `border`，只有 `RadioProps` 有）。`WAIVERS` 成立，实现无误 |
| 2 | [input.md](./input.md) 第九章第 11 条 | `buttonIcon` 存的是 Element UI 类名（如 `el-icon-search`），需确认如何映射到 EP 的图标组件 | ⬜ 待核实 |
| 3 | [00-通用字段行为规范.md](./00-通用字段行为规范.md) 第二章 | `FormItem.vue` 的标签宽度 / 必填星号规则未审计，需单独核对 | ⬜ 待核实 |
| 4 | [select.md](./select.md) 第九章第 12 条 | EP 的 `ElSelect` 是否在一次选择中同时触发 `update:model-value` 和 `change` | ⬜ 待核实 |
| 5 | [00-通用字段行为规范.md](./00-通用字段行为规范.md) 第六、八章 | 运行期数据模型、校验层、字段 API **在当前架构中不存在**（见第八节） | 🔴 **阻断性** |

---

## 七、实现进度与架构阻断点

### 7.1 批 0 三个组件：已完成的部分

只做了**组件本地可闭环**的改动（不依赖架构变更），全部通过 `pnpm -r test`（292 项）与 `pnpm -r typecheck`：

| 组件 | 改动 | 对应用户可见效果 |
|---|---|---|
| `FormItem.vue` | **移除**把 `requiredHint` / `validationHint` 当常显提示文字渲染的 `<p>` | 必填/校验文案不再永久挂在控件下方（参考实现里它们是**校验失败时的错误文案**，不是说明文字） |
| `input` | 新增 `type: 'number'`，并按参考语义**屏蔽渲染为 `text`** | 属性面板可选"数字"，且非法输入能被校验层看到（而非被浏览器吞掉） |
| `input` | `placeholder` 默认 `'请输入'` → `''`；`size` 默认 `'default'` → `''` | 未填占位时不再强插"请输入"；尺寸回落由表单设置继承 |
| `select` | **补 `defaultFirstOption`**（由 `filterable && allowCreate` 推导，不新增开关） | 可搜索+可创建时，回车能选中第一个匹配项 |
| `select` | **`remoteMethod` 条件绑定**：无 `onRemoteQuery` 时绑 `undefined` | `remote: true` 但未配远程回调时，不再每次输入触发一次"空查询" |
| `select` | `placeholder` 加兜底（`\|\| '请选择'`）、默认值改为 `''`；`size` 默认改 `''` | 清空占位时仍显示"请选择"；尺寸可继承 |
| `radio` | **`displayStyle` 改为无条件绑定到 CSS `display`** | `inline` 时是真正的 `inline`（而非 EP 默认的 `inline-block`），折行与间距与参考一致 |
| `radio` | `optionItems` 组件默认 `[]`（初始选项交给物料清单）；`size` 默认 `''` | 运行时未传选项时不再凭空出现 3 个假选项 |
| `radio` | 补注释记录 EP `border` 的核实结论 | 防止后人把"上游差异"误当"抄漏" |

### 7.2 阻断点记录：运行期数据模型、校验层、字段 API 当时**不存在**

> **本节是第 1、2 步开工前的现场记录**，保留以说明当时为什么"静态审计全绿却处处不对"。
> 截至当前：**第 4、5、7、8 行已解决**（值同步见 7.4，字段 API 见 7.5）；
> **第 6 行（校验层）尚未动**，属第 3 步。

规格中**份量最大**的几块——运行期值同步、事件语义（含 `oldValue`）、校验时机、选项通道、
以及 `fieldMixin` 那 60+ 个公开 API——**都无法在组件层实现**，因为承载它们的东西没有接线。

证据链：

| # | 事实 | 位置 | 现状 |
|---|---|---|---|
| 1 | `overrides` 是响应式的按节点 prop 覆盖表，`resolveProp` **优先读它** | `runtime/src/context.ts` | 仍然成立 |
| 2 | 写入方法 **`setNodeProp`**（不是 `setOverride`）存在，且已实现"编辑器 / 预览"分发 | `runtime/src/context.ts` | 仍然成立 |
| 3 | **但 `setNodeProp` 全仓库零调用**——该机制从未接通 | `grep -rn "setNodeProp" packages/` → 当时无结果 | ✅ 已接通（`setNodeValue` + 渲染器） |
| 4 | 渲染器只把 `node.events` 接成 `onXxx`，**没有**接 `update:modelValue` | `runtime/src/renderer.ts` | ✅ 已接线（7.4） |
| 5 | `FormItem.vue` 是自绘 div 布局，**不是** `el-form-item`，没有 `rules`/`prop` | `materials/src/components/FormItem.vue` | 仍然成立 |
| 6 | 清单里 `validation` 的说明直接写明"**画布不做即时校验**" | `materials/src/manifest.ts` | ✅ 已实现（7.7）：运行时校验 + 画布 `designMode` 不校验 |
| 7 | `FormEngine`（值/错误/touched/dirty/validate/reset）**已存在**，但只被另一条独立路径 `FormRenderer` 使用 | `core/src/form/engine.ts`、`runtime/src/form/renderer.ts` | ✅ 校验已补齐（7.7），但**没有走 FormEngine**——它面向扁平 `FormSchema`，而这里规则挂在节点上，直接推导更贴合 |
| 8 | `RuntimeContext.registerForm(formId, engine)` 存在，但 schema 渲染路径不使用它 | `runtime/src/context.ts` | ⬜ 仍未使用（同上：当前不需要 FormEngine 那条路） |

**结论：零件都在，缺的是接线。** 这解释了为什么"静态审计 28/28 全绿 + 292 测试全过，
但一操作就不对"——**当时没有任何一层在承载"值"这件事**。

当时的具体后果（已由 7.4 / 7.5 / 7.7 解决或部分解决）：

- ✅ 在输入框里打字，schema 不会更新（组件实际是非受控的，值只活在 DOM 里）→ 7.4 已修
- ⬜ `onChange(value, oldValue)` 拿不到 `oldValue`（没有值的历史）→ **仍未做**，需一层值历史
- ✅ `required` / `validation` 配了也**不产生任何错误提示** → 7.7 已修
- ✅ `setValue` / `getValue` / `resetField` / `setDisabled` / `setHidden` / `loadOptions` … 无处调用 → 7.5 已补
- ⬜ `optionData` → `optionItems` 的动态注入通道不存在 → 仅补了"直接写 `optionItems`"，**数据源绑定通道仍未做**

### 7.3 共性层三步计划

| 步 | 内容 | 落点 | 状态 |
|---|---|---|---|
| **1** | **接通值同步**：渲染器把 `update:modelValue` 接到 `ctx.setNodeValue()`（写入响应式 `overrides`，由 `resolveProp` 优先读取） | `runtime/src/renderer.ts` + `context.ts` | ✅ **已完成**（见 7.4） |
| **2** | **字段注册表 + 字段 API**：以节点 `name` 为键寻址，落地 `getWidgetRef` / `setValue` / `getValue` / `resetField` / `setDisabled` / `setHidden` / `setRequired` / 选项与样式操作。参考实现的 `refList` 语义见 [00-通用字段行为规范.md](./00-通用字段行为规范.md) 第五章 | `runtime/src/field.ts` + `context.ts` | ✅ **已完成**（见 7.5） |
| **3** | **校验层**：把校验规则接到 schema 渲染路径，错误文案经 `FormItem` 展示。语义照 [00-通用字段行为规范.md](./00-通用字段行为规范.md) 第四章 | `core/src/form/validators.ts` + `runtime/src/context.ts` + `materials/FormItem.vue` | ✅ **已完成**（见 7.7） |

### 7.4 第 1 步已落地（值同步）

发现：`RuntimeContext.setNodeProp()`（`context.ts:282`）**早已实现好**"有 `onSetNodeProp` 走编辑器，否则走本地 override"的分发逻辑，
`resolveProp()` 也**早已优先读取** `overrides`——**只是渲染器从未调用它**。所以这一步是"接线"，不是"造轮子"。

| 改动 | 文件 | 说明 |
|---|---|---|
| 新增 `setNodeValue(nodeId, value)` / `getNodeValue(nodeId)` | `runtime/src/context.ts` | 字段值**永不走 schema 历史**，与 `setNodeProp` 有意区分 |
| 渲染器接上 `onUpdate:modelValue` | `runtime/src/renderer.ts` | 仅对声明了 `modelValue` 的节点接线，不给所有物料挂无用监听 |
| 修掉"建桶 + 赋值"两段式写入 | `runtime/src/context.ts` | 原本首个字符会触发**两次**整树重渲染（`setNodeProp` 有同样问题，一并修掉） |
| 5 个新测试 | `runtime/src/runtime.test.ts` | 接线存在性 / 不越界接线 / 写回不改 schema / 响应式且每次写入只触发一次 / 受控重渲染 |

**设计要点**：`setNodeValue` 就是第 3 步接入 `FormEngine` 的接缝——届时只需替换它的函数体为 `engine.setValue(fieldName, value)`，**渲染器无需改动**。

**设计器里的语义自动正确**：`EditorEngine.record()` 每次 schema 变更都会重建 `RuntimeContext`（`editor-engine.ts:98`），
所以覆盖值随之清空、schema 的新"默认值"重新生效——**正是参考实现 `refreshDefaultValue()` 的效果**，无需额外代码。

**已验证**：`pnpm -r test` 全过（runtime 33 → 38）；`pnpm -r typecheck` 全过。
当时只在 vnode 层验证了接线与写回；**真实 `ElInput` 的输入交互后来由 7.6 的组件级测试补上**。

**仍未覆盖**：真实浏览器里的布局与事件时序（见 7.6 末）。手动验证方法：
`pnpm dev` → 拖一个输入框到画布 → 在画布里输入 → 值写回运行时（不写进 schema 的"默认值"）；
再改属性面板的"默认值"，画布应随之刷新。

### 7.5 第 2 步已落地（字段注册表 + 字段 API）

**新增 `packages/runtime/src/field.ts`** —— `FieldHandle` 把一个字段节点的读写能力封装成**与参考实现同名**的 API。

命名寻址：`RuntimeContext.resolveNodeId(nameOrId)` / `getWidgetRef(nameOrId)`。
建构造期建立 `node.name → nodeId` 索引（O(1)），**重名时后者覆盖前者**——与参考实现 `refList` 行为一致。

#### 通道映射（这是本步最关键的设计）

| 参考 API | 本架构通道 | 为什么 |
|---|---|---|
| `getValue` / `setValue` / `resetField` | **运行时值存储**（`setNodeValue` 等） | 值是活数据，**永不写 schema**，否则输入内容会变成默认值并污染撤销历史 |
| `setDisabled` / `setReadonly` / `setRequired` / `setLabel` / `setOption` / `loadOptions` / `reloadOptions` / `disableOption` / `enableOption` / `addClass` / `removeClass` | **属性写入**（`setNodeProp`） | 这些在参考实现里改的正是 `field.options.*`（配置），故应走属性通道：编辑进 schema 历史，预览落本地覆盖 |
| `setHidden` | **节点级** `setNodeHidden` → `resolveHidden` | `hidden` 在本架构里是 `node.meta.hidden`，**不是**组件 prop（见 `manifest.ts` 的 `systemProps` 与 `PropField.vue` 的 hidden 分支），所以走不了 `setNodeProp` |

#### 与前一步同源的语义

- `resetField()` = **删除**值覆盖（不是写 `undefined`，因为 `resolveProp` 用 `!== undefined` 判断覆盖存在），值自然回落 schema 默认值
- `setHidden` / `setNodeHidden` 同样"一次写入"，避免两次响应式更新
- `loadOptions` 与 `reloadOptions` 实现**故意完全相同**——参考实现里就是如此（`clearSelectedOptions` 那行被注释掉了），见 [00-通用字段行为规范.md](./00-通用字段行为规范.md) 6.2
- `disableOption` 按 `value` 匹配，**拷贝后写回**，不就地改 schema 数组

#### 有意**未提供**的参考 API（连同原因写在 `field.ts` 末尾）

| API | 原因 |
|---|---|
| `focus()` / `getFieldEditor()` | 需要持有组件实例（参考实现靠 `$refs['fieldEditor']`）。本架构没有实例注册表；若确需再加 `ref` 回调注册表 |
| `setUploadHeader` / `setUploadData` / `setToolbar` | 写的是组件**内部 data**，属组件自身状态而非节点配置，需先决定是否上提到 schema |
| `isSubFormItem()` | 取决于子表单容器是否落地（当前物料清单里没有 sub-form） |

#### 顺带修掉 7.6 记录的陈旧 `provide` 缺陷

- `RUNTIME_CONTEXT_KEY` 类型改为 `InjectionKey<ShallowRef<RuntimeContext>>`
- 渲染器 `provide` 一个 `shallowRef` 并在 `watchEffect` 里同步
- `materials/src/use-runtime.ts` 的 `useRuntimeContext()` 改为返回 **`ComputedRef`**（调用方从 `runtime?.` 改为 `runtime.value?.`）

**已验证**：新增 24 个测试（`field.test.ts` 23 + `runtime.test.ts` 1）；陈旧 `provide` 的守卫做了**反向验证**（回退即失败，还原即通过）。上下文替换的**同实例内更新**行为另由组件级测试覆盖，见 7.6。


### 7.6 DOM 测试环境已就位（补齐验证盲区）

**问题**：第 1、2 步做完后发现，原先所有测试都跑在 `node` 环境（`createSSRApp` + `renderToString`），
**凡"必须真实挂载才能观察到"的行为，一条自动化覆盖都没有**——而这恰好是本轮所有用户可见问题的共同特征。

**已引入**（仅 `packages/materials`，其余包保持 `node` 环境）：

| 依赖 | 位置 |
|---|---|
| `happy-dom` | `packages/materials` devDeps |
| `@vue/test-utils` | 同上 |
| `@vitejs/plugin-vue` | 同上（vitest 需要它才能编译 `.vue`） |

配置方式：`vitest.config.ts` 挂 `vue()` 插件，**默认仍是 `node` 环境**；
需要真实挂载的用例在文件头用 `// @vitest-environment happy-dom` 单独声明——
不给清单 / 一致性审计等纯逻辑用例套上 DOM 环境。

**新测试文件**：`packages/materials/src/components/field-interaction.test.ts`（16 个用例），逐条闭合前述盲区：

| # | 覆盖内容 |
|---|---|
| 1 | 在**真实 `ElInput`** 里 `setValue` 后值写回运行时，且 schema 默认值不变；`resetField()` 后 DOM 与值一起回落 |
| 2 | 上下文被替换（`setProps`）后，`useRuntimeContext()` 读到的是**新**上下文；注入方拿到的是 `ref` |
| 3 | `radio` 的 `displayStyle`：`inline` → 元素 `style.display === 'inline'`；`block` → `'block'`；按钮分支同样生效；按钮分支不残留 `border` 属性 |
| 4 | `select`：`defaultFirstOption` 在 `filterable && allowCreate` 时为真、单独开任一项时为假；`remoteMethod` 无回调时为 `undefined`；`placeholder` 为空回落「请选择」 |
| 5 | `FormItem` 不再把 `requiredHint` / `validationHint` 当常显提示渲染；必填时标签前有星号 |

**5 项全部做了反向验证**——逐条把对应实现回退，确认相应用例失败，再还原：

| 回退内容 | 结果 |
|---|---|
| `provide` 改回直接传 context | ✅ 失败 |
| `radio` 回到"仅 block 才设样式" | ✅ 失败 |
| 去掉 `select` 的 `:default-first-option` 绑定 | ✅ 失败 |
| 让 `onUpdate:modelValue` 的写回变空操作 | ✅ 失败 |
| 恢复 `FormItem` 的常显提示 | ✅ 失败 |

**当前状态**：全套 **379 项通过**，7 个包 typecheck 通过。

**仍不在覆盖范围内的**：真正的浏览器交互（下拉浮层定位、`z-index`、真实鼠标事件序列、CSS 布局/折行）。
happy-dom 没有真实布局引擎——像 `questionBug.md` 里 question2 那种"重渲染夹在事件分发中间"的问题，
仍然只能在真实浏览器里复现。这类问题建议沿用 `questionBug.md` 的无头 Chrome + CDP 方法。

> 若决定**不做**共性层（例如本项目的定位就是"设计器 + 代码生成"，
> 运行期行为交给生成出来的代码），那也是一个成立的决策——
> 但需要把 [00-通用字段行为规范.md](./00-通用字段行为规范.md) 里
> 第三章（事件语义）、第四章（校验语义）、第六章（选项通道）、第八章（字段 API）
> 整体标记为"由代码生成承接，不在画布/运行时实现"，并同步更新 `conformance` 的契约。

### 7.7 第 3 步已落地（校验层）

三步计划走完。校验规则来源是**节点自身的 props**（不是独立的 `FormSchema`），
所以没有走 `FormEngine` 那条路——`FormEngine` 面向的是扁平 `FormSchema` + `DataModel`，
而这里每个字段的规则就挂在自己的节点上，直接推导更直接、也少一层投影。

| 改动 | 文件 | 说明 |
|---|---|---|
| 移植内置校验器 | `core/src/form/validators.ts`（新） | 9 个内置校验器 + 正则兜底；保留"空值不校验"与"按 length 判空"两条关键语义 |
| 规则推导 + 校验执行 | `runtime/src/context.ts` | `buildFieldRules` / `validateField(nodeId, trigger?)` / `validateAll` / `getFieldError` / `clearFieldErrors` |
| 字段身份 provide | `runtime/src/renderer.ts` + `field.ts` | 新增 `FIELD_CONTEXT_KEY` 与 `FieldContextProvider`，让物料（含 `FormItem`）知道自己属于哪个节点 |
| 校验接线 | `runtime/src/renderer.ts` | 字段节点的 `blur` → 按 `blur` 过滤校验；`change` → **不过滤**（跑全部规则，清掉过期必填错误） |
| 错误展示 | `materials/src/components/FormItem.vue` | 新增 `.lc-form-item__error`，从上下文按 `nodeId` 读错误 |
| 设计态不校验 | `runtime/src/renderer.ts` + `editor/.../Canvas.vue` | 新增 `RuntimeRenderer.designMode`，画布传 `true`；预览与运行时宿主保持默认 `false` |

#### 三个值得记录的判断

**1. ⚠️ 参考实现的 `trigger` 区分在净效果上不起作用——这是读代码得出的结论**

参考实现给必填规则的 trigger 只有 `['blur']`，注释说是为了避开"change 时 formModel 尚未更新"的竞态。
但它的 `handleChangeEvent` 会在同步完值之后**显式调用** `el-form.validateField`，
而 Element UI 的 `validateField` 传空 trigger → **不过滤规则 → 所有规则都会跑**。
再加上每条规则都含 `blur`，所以 blur 时同样全跑。

**净效果：blur 和 change 都会跑全部规则。** 那个 `['blur']` 是为了绕开 Element
**内部控制**在 change 时先校验再同步的时序问题；本架构把校验挂在组件自身 emit 的
blur/change 上（`update:modelValue` 已先落地），不存在该竞态，因此无需该 workaround。

仍然保留了 `trigger` 字段以便独立测试契约，但调用方默认传空（跑全部）。

**2. 隐藏字段不产生规则** —— 参考实现 `setHidden(true)` 会显式清空规则，
但它的 `buildFieldRules` 守卫写的是 `if (!formItemFlag && hidden) return`（`&&`），
对于 `formItemFlag: true` 的字段恒为假 → 初始就 hidden 的字段仍带着规则。
本实现统一成"隐藏即不校验"，消掉这个不一致。

**3. ⚠️ 一个被测试抓出来的真 bug：`watchEffect` 的意外依赖追踪**

进设计态时清空遗留错误的 `watchEffect` 里调用了 `clearFieldErrors()`，
而它会读 `fieldErrors` 的键 → **该读取被纳入依赖** → 每次错误变化都会重跑 →
把刚校验出来的错误立刻清掉，导致 `if (!designMode)` 守卫形同虚设。
改用 `watch(() => props.designMode, cb, { immediate: true })`：只追踪 `designMode`。

这个 bug 是靠**反向验证**发现的——把设计态守卫去掉后用例居然仍通过，顺着线索才找到根因。

#### 本轮新增测试（共 61 个）

| 文件 | 数量 | 覆盖 |
|---|---|---|
| `core/src/form/validators.test.ts` | 35 | 空值语义（含 `0`/`false` 不算空的怪癖）、9 个内置校验器、正则兜底、非法正则不抛异常、未实现校验器、必填文案不带 `[label]` 前缀 |
| `runtime/src/validation.test.ts` | 23 | 规则推导（trigger / 隐藏 / 覆盖生效）、错误写入与清除、trigger 过滤、`validateAll`、`clearFieldErrors` |
| `materials/.../field-interaction.test.ts`（新增 11 个） | 27 | **真实挂载**下错误的出现与消失时机、设计态不校验、切回设计态清空、多字段互不干扰、radio 选中不误报 |

#### 反向验证（逐条回退实现，确认用例变红）

| 回退内容 | 结果 |
|---|---|
| 「空值不校验」→ 空串也走正则 | ✅ 失败 |
| 去掉 change 后的全量校验 | ✅ 失败 |
| 去掉设计态守卫 | ✅ 失败 |
| 去掉 blur 校验接线 | ✅ 失败 |
| `FormItem` 不再渲染错误 | ✅ 失败 |

#### 顺带发现（Element Plus 行为，写进测试注释以免后人踩）

**EP 的输入框必须先 `focus` 再 `blur` 才会 emit `blur`**：它用 `useFocusController` 管理焦点，
裸 `blur` 不会触发。测试里的 `blurInput()` 辅助函数封装了这个真实交互序列。

#### 仍未做（有意）

| 项 | 原因 |
|---|---|
| `onValidate`（用户写代码做自定义校验） | 参考实现用 `new Function`；本仓库物料清单里**没有**声明该配置项。若要支持需先决策沙箱/CSP 方案 |
| `onChange(value, oldValue)` 的值历史 | 需要一层值历史存储；参考实现靠 `oldFieldValue` 手动维护。当前 `onChange` 动作能拿到事件参数，但拿不到"旧值" |
| `validate-on-rule-change` 等价开关 | Element 的 `el-form` 有该配置；本实现每次校验都是显式调用，不存在"改规则自动校验"的路径 |
| `optionData` → `optionItems` 的动态数据源通道 | 目前只能通过 `FieldHandle.loadOptions` 直接写 `optionItems`；绑定到数据源尚未做 |

**当前状态**：全套 **449 项通过**，7 个包 typecheck 通过。

---

## 八、相关文档
| 文档 | 内容 |
|---|---|
| [`docs/conformance.md`](../conformance.md) | 静态一致性审计（声明面）——本报告是它的行为面补充 |
| [`docs/conformance-report.md`](../conformance-report.md) | 审计报告（自动生成） |
| [`docs/material-library.md`](../material-library.md) | 物料清单与移植说明 |
| [`docs/setting-panel.md`](../setting-panel.md) | 设置面板说明 |
| [`docs/designer-ui.md`](../designer-ui.md) | 设计器界面说明 |
| [`docs/questionBug.md`](../questionBug.md) | 已修复问题的根因记录（复现—验证方法论） |
