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

**当前状态**：全套 **462 项通过**，7 个包 typecheck 通过。

### 7.8 真机验证：已发现并修复一个 happy-dom 测不到的真 bug

**为什么必须做这一步**：`questionBug.md` 记录过"合成事件测不出、真实鼠标可稳定复现"的问题；
而 happy-dom **没有布局引擎**——`inline` vs `inline-block`、浮层定位、`z-index` 一律测不到。

#### 工具：`scripts/cdp-inspect.mjs`

用 CDP 驱动无头 Chrome。**只用 Node 24 内置的全局 `WebSocket`，不装 puppeteer/playwright**。

```bash
node scripts/cdp-inspect.mjs --url http://localhost:5174/ --wait ".lc-canvas" \
  --eval "document.title" --click ".lc-node" --out /tmp/shot.png
```

支持：等待选择器、多次求值、**真实鼠标点击**（`Input.dispatchMouseEvent`，不是 `element.click()`）、
逐字符输入（`Input.dispatchKeyEvent`）、失焦、截图、收集 console error/exception/warning。

⚠️ 多步交互必须用 `--steps`（按顺序执行），**不要**用 `--click/--type/--eval` 组合：
后者是"分阶段"的（所有点击 → 所有输入 → 所有断言），无法表达"点击 → 断言 → 再输入 → 再断言"，
曾导致"输入发生在失焦之后、输入框根本没聚焦"的假失败。

```bash
node scripts/cdp-inspect.mjs --url http://localhost:5174/ --wait ".lc-canvas" \
  --steps '[{"click":"#target-input"},{"type":"abc"},{"click":".lc-preview-bar"},
            {"wait":300},{"assert":"document.querySelector(\".lc-form-item__error\")?.textContent"}]'
```

步骤类型：`{eval}` `{assert}` `{click}` `{type}` `{blur}` `{wait}`（毫秒）`{screenshot}`。

⚠️ 两个踩过的坑（已写进脚本注释）：
1. **Chrome 在受限环境里会以 `SIGTRAP` 崩溃**（自身沙箱起不来），必须加
   `--no-sandbox --disable-setuid-sandbox --disable-breakpad --disable-crashpad`。
   崩溃时表现为"脚本静默 exit 0"，所以脚本现在会把 ws 关闭与 Chrome 退出显式报出来。
2. vite 的 dev server 默认只绑 **IPv6 `[::1]`**，用 `127.0.0.1` 连不上，要用 `localhost`。

#### 如何在真机里构造任意场景（无需改动应用）

dev 模式下 Vue 实例可达：从 `document.querySelector('#app').__vue_app__` 遍历组件树，
可以拿到 `Designer` 的 `setupState.ctx`（`DesignerContext`），于是能在浏览器里
`ctx.insertMaterial('radio')` / `ctx.updateProps(id, {...})` / `ctx.togglePreview()` 任意构造与断言。
注意 `ctx.schema` / `ctx.runtime` 是 `shallowRef`，需要解包。

> ℹ️ 发现 1 这类「上游 CSS 语义变化」后来被**机械化**了：见
> [`docs/upstream-diff-report.md`](../upstream-diff-report.md) 与 `docs/conformance.md` 第八节。
> 那份审计几秒钟就能标红 radio 这个坑，不必再靠逐个真机探针去找。
> 真机验证仍然必要——它负责确认**到底有没有影响**，审计只负责**列出嫌疑**。

#### 🔴 发现 1（已修）：radio 的 `displayStyle` 在 Element Plus 上**静默失效**

真实 Chrome 实测（element-plus 2.14.4）：

| 容器 `display` | `displayStyle` | 选项不同行数 | 结论 |
|---|---|---|---|
| `inline-flex`（EP 默认） | `block` | **1** | ❌ 三项挤同一行，属性面板改了没效果 |
| `inline-flex`（EP 默认） | `inline` | 1 | 碰巧对 |
| `inline-block`（修复后） | `block` | **3** | ✅ 每项独占一行 |
| `inline-block`（修复后） | `inline` | 1 | ✅ |

**根因**：参考实现里 `.el-radio-group` 是 `display: inline-block`（Element UI 2.x），
所以 `:style="{display: displayStyle}"` 绑在选项上能真正生效。
**Element Plus 把容器改成了 `display: inline-flex`** —— 选项成为 flex item 后，
其 `display` 按 CSS 规范被「块化」（`inline` → `block`），于是 `displayStyle` 完全失去作用。

**修法**：在 `Radio.vue` 里把容器恢复成 `inline-block`（`<style scoped>` + `:deep`）。
取 `inline-block` 而非 `block`，是因为后者会让选项撑满整行（实测 784px），与参考的收缩行为不一致。

**为什么之前三层测试都没抓到**：
- happy-dom 没有布局引擎，`getComputedStyle` 不反映真实 flex 布局
- 单测断言的是 `element.style.display === 'inline'`（inline style 字符串）——**它确实是对的**，
  失效发生在布局阶段，字符串断言看不见
- 静态一致性审计更不可能发现（它只看属性是否绑定）

**这正是"测试全绿但实际不对"的又一例**，也是先做真机验证的理由。

#### 🟠 发现 2（待办）：checkbox 的上游 CSS 差异

| | Element UI 2.x | Element Plus 2.14 |
|---|---|---|
| `.el-checkbox` | `display: block; margin-right: 5px; margin-bottom: 8px; margin-left: 5px` | `display: inline-flex; margin-right: 30px` |
| `.el-checkbox-group` | `font-size: 0` | `font-size: 0; line-height: 0` |

`Checkbox.vue` 目前用的是旧写法（`displayStyle === 'block' ? 'display: block' : undefined`）。
因为 EP 的 `.el-checkbox-group` **不是** flex，所以 `block` 模式实测**能正常换行**（3 行）——
但 `inline` 模式依赖 EP 的默认 `inline-flex`，且**间距与参考不同**（30px vs 5px/8px）。
不在本轮三个组件范围内，登记待办。

#### 🟡 发现 3（无害）：`/favicon.ico` 404

控制台里唯一的 error 是 favicon 404，与业务无关，可忽略或在 `index.html` 补一个。

#### ⚠️ 截图说明

`cdp-inspect.mjs` 能截图，但**当前会话的模型不支持读图**，所以截图需要人工查看。
因此本轮的结论全部来自**可断言的度量**（`getBoundingClientRect` / `getComputedStyle` /
`elementFromPoint`），而不是"看图觉得对"——这反而更严格。

#### 真机验证结果（V2–V6）

全部用**真实鼠标**（`Input.dispatchMouseEvent`）与**真实键盘**（`Input.dispatchKeyEvent`），
在真实布局引擎下断言 `getBoundingClientRect` / `getComputedStyle` / `elementFromPoint`。

| # | 验证项 | 结果 |
|---|---|---|
| **V2** | input 的 `placeholder` 默认值 | schema `""`、DOM `placeholder=""` ✅（不再强插"请输入"）；`updateProps` 设为 `"请输入姓名"` 后 attr 同步 ✅ |
| **V2** | select 的 `placeholder` 为空时兜底 | 渲染出 `"请选择"` ✅ |
| **V3** | FormItem 不再常显 `requiredHint`/`validationHint` | `.lc-form-item__hint` 不存在、两个文案都不在 DOM ✅；必填星号仍在 ✅ |
| **V4** | 预览模式：空值失焦 | 出现 `"字段值不可为空"` ✅（正是参考实现的文案） |
| **V4** | 预览模式：输入值后失焦 | 错误**被清除**（`errors: []`，输入值 `"abc"`）✅ |
| **V5** | 真实鼠标点上移/下移（`questionBug` question2 回归） | 选中 **不跳走**：点击「下移」后 `selectedNodeId` 仍是 `n_title`，顺序变为 `[n_select, n_title, …]` ✅ |
| **V6** | 下拉浮层是否遮挡操作条（`questionBug.md` 遗留项） | **当前不复现**，详见下 |

**V6 细节（值得记一笔——它是"潜伏"而非"已解决"）**：

```
打开下拉后：可见浮层 1 个，矩形 {x:293, y:177, w:814, h:82}
          上移按钮中心 {x:1008, y:156}，操作条底边 ≈ y:166
          重叠：false ；该点最上层仍是 lc-node__action
```

操作条定位是 `bottom: -2px; right: -2px; z-index: 10`（节点右下角），
而 EP 的下拉默认**在节点下方展开**（`y:177`），与操作条底边（≈166）**只差约 11px**。
水平方向两者是重叠的（浮层 x 跨度 293–1107，按钮 x=1008）。

**所以它没被遮住只是因为那 11px 的垂直余量**，而 EP 的 popper z-index 远高于 10
（一旦重叠，浮层必然盖住操作条 → 就是 `questionBug.md` 描述的现象）。
改主题 offset、改操作条定位、或节点变矮，都可能让它复现。**建议登记为已知脆弱点。**

#### 🔴 发现 4（已修）：拖拽落点在**有隐藏节点时插错位置**

拖拽落点必须用真实拖拽手势验证——HTML5 DnD 由浏览器原生手势触发，合成事件驱动不了。
本仓库的插入逻辑不依赖 `dataTransfer`，而是用 `state.dragState`（dragstart 设置）
与 `state.dropTarget`（dragover 按坐标算），所以"真实手势 + 坐标断言"能完整覆盖。

**修复前实测（demo schema，`n_input` 的 `visible` 绑定为假所以不渲染）**：

| 落点 | 拖拽中算出的 target | 实际插入后的 schema 根顺序 |
|---|---|---|
| 画布中心（所有节点之下，应追加到末尾） | `index: 4` | `[n_title, n_select, **n_input**, n_table, **NEW**, n_button]` ❌ |

NEW 插在了 `n_table` 与 `n_button` **之间**，而不是末尾。

**根因**：落点索引由 `computeListDrop` 按画布上**渲染出来的**子节点计算（用 DOM 矩形），
却直接当成 **schema 的 children 索引**使用。而 schema 里还有**不渲染**的节点
（`visible` 绑定为假 / `meta.hidden`）——它们不在 DOM 里，却仍占着顺序槽位。
demo 的 `n_input` 正好在中间，于是每个落点都整体偏移一格。

**这与 `docs/questionBug.md` 的 question3 是同一个根因**：
那次修了上移/下移（给 `moveNodeUp/moveNodeDown` 加了 `isVisible` 参数），
**但落点这条路径漏了**——同一个坑，只堵了一半。

**修法**：新增纯函数 `visibleIndexToSchemaIndex(fullIds, visibleIds, k)`
（`engine/drop-target.ts`），把可见索引换算成 schema 索引：
插到"第 k-1 个可见节点之后"，这样隐藏节点不会让落点整体偏移。
`Canvas.computeDrop` 在算出落点后用它对 `target.index` / `target.beforeId` 做换算
（指示条仍用可见索引，它本来就是视觉量）。

**修复后实测**：

| 落点 | schema 根顺序 | 可见顺序 |
|---|---|---|
| 画布中心 | `[n_title, n_select, n_input, n_table, n_button, **NEW**]` ✅ 追加到末尾 | `[…, n_button, NEW]` |
| 顶部 | `[**NEW**, n_title, n_select, n_input, n_table, n_button]` ✅ | `[NEW, n_title, …]` |

新增 6 个纯函数单测覆盖该换算（含隐藏节点在前/在中/在后、可见列表为空、锚点缺失）。

#### 🔴 发现 5（已修）：画布内拖拽排序 —— 暴露了 core 里一个潜伏 bug

物料拖入验完后，顺手验**画布内拖拽排序**（`source: 'canvas'` 分支，代码路径不同）。
结果抓出两个问题，且都是"只堵了一半"的同类：

**5a. 我自己在发现 4 的修法里引入的回归**

物料拖入与画布内移动的索引空间**不一样**：

| 场景 | 被拖节点在不在列表里 |
|---|---|
| 物料拖入（INSERT） | 不在——只需要按隐藏节点数偏移 |
| 画布内移动（MOVE） | `NodeTree.move` **先 detach 再插入**，而 `collectLists` 也已把被拖节点滤掉 → 基准列表必须同样排除它 |

我第一版换算用的是含被拖节点的完整列表，于是移动排序会整体偏一位。
修法：`schemaChildrenOf(containerId).filter((id) => id !== draggedId)`
（物料拖入时 `draggedId` 为 undefined，此过滤是空操作）。

**5b. `NodeTree.resolveIndex` 的 `beforeId` 对根级永远是空操作**

为了稳，我给 `moveNode` 补上了 `beforeId`（`insertMaterial` 早就优先用它）。
补完发现"把最后一个节点拖到最前"**完全没反应**。定位到：

```ts
// resolveIndex 里
const index = list.findIndex((id) => id === options.beforeId)
```

而两种列表的**元素类型不同**：
- 根级：`move` 传的是 `this.nodes` → **`PageNode[]`（对象）**
- 容器插槽：`getSlotList` 返回 **`string[]`（id）**

所以根级比较 `对象 === 'n_title'` 永远为 false → 退化成 `list.length` → **总是追加到末尾**。
`insertMaterial` 之所以没踩到，是因为它自己先用 `getPosition(beforeId)` 解析成 index，从不把
`beforeId` 传进 `insert`。也就是说这个分支**此前从未被走到过**，属于潜伏 bug。

修法：按元素类型分别取 id（`typeof item === 'string' ? item : item.id`），并补 3 个单测。

**实测（画布内拖拽排序）**：

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 最后 → 最前（拖 `n_button` 到顶部） | 顺序**完全不变** ❌ | `[n_button, n_title, n_select, n_input, n_table]` ✅ |
| 最前 → 最后（拖 `n_title` 到底部） | `[n_select, n_input, n_table, n_button, n_title]` ✅ | 同样 ✅ |

反向验证：把 `resolveIndex` 回退成旧的比较，2 个根级用例立即变红。

> **这一条是本轮最有价值的教训**：如果不是坚持"新改动也要用真机验一遍"，5a 会把一个回归
> 直接提交进去；而 5b 会继续潜伏，直到有人把节点拖到最前时才发现"没反应"。

#### ✅ 发现 6（非 bug）：拖到非 `droppable` 容器上会落到根级

实测把输入框拖到 demo 的 `n_table`（数据表格）上，落成了**根级兄弟**而非表格内部。
核对清单后确认这是**设计如此**：`droppable: true` 只有 4 个物料——
`card` / `grid-col` / `layout-table-cell` / `tab-pane`；`table`（数据表格）不是布局容器。

用真正的可放置容器（卡片）复测：新节点归属为 `{ 父: <卡片 id>, 槽: 'children' }` ✅。

#### ✅ 发现 7：跨容器拖拽两个方向都正确

| 场景 | 结果 |
|---|---|
| **根层节点 → 拖进卡片** | 归属 `{父: <卡片>, 槽: 'children'}`、卡片 children = `[n_title]`、根层不再含它 ✅ |
| **卡片内节点 → 拖出到根层** | 归属 `{父: null, 槽: 'root'}`、卡片 children = `[]`、根层末位是它 ✅ |

节点总数 6 → 7，无重复、无丢失（扁平存储下 `nodes` 与 `children` 引用保持一致）。

#### ✅ 发现 8：拖入 `grid-col` 正确（顺带发现一个潜在限制）

拖输入框进栅格第 1 列 → 归属 `{父: <col0>, 槽: 'children'}`，`col0.children=[新节点]`、`col1.children=[]` ✅

| 元素 | computed display | `axisOf` 结果 |
|---|---|---|
| `.el-row`（栅格行） | `flex` / `row` | 会返回 `'x'` |
| `.el-col`（列） | `block` | `'y'` ✅ 正确（列内子节点纵向堆叠） |

🟡 **潜在限制（非当前 bug）**：`computeDrop` 传给 `axisOf` 的是
`document.querySelector('[data-node-id="…"]')`，也就是**编辑器自己的 `.lc-node` 包裹层**，
而不是物料自身的根元素。实测该包裹层与 `.lc-runtime-root` 都是 `display: block`，
因此 **`axisOf` 恒返回 `'y'`，`'x'` 分支在当前接线下不可达**。

现有的 4 个可放置容器（`card` / `grid-col` / `layout-table-cell` / `tab-pane`）内部都是纵向堆叠，
所以行为正确。但**将来若加入横向容器**（如行内布局 / flex-row 容器），
落点索引会按 y 轴计算 → 插入位置错误。
`drop-target.ts` 的 `'x'` 分支本身有单测覆盖，缺的是接线；届时需要让 `axisOf` 看到物料的真实根元素。


#### 仍然只能在真机做的验证

| 项 | 说明 |
|---|---|
| 纯视觉观感 | 当前会话的模型不支持读图，间距/对齐是否"好看"需要人工看截图 |
| 更多组件的浮层与定位 | 本轮的浮层检查只覆盖了 select；date/time/cascader 的 popper 未验 |
| 拖拽落点 | 画布用 HTML5 DnD，合成鼠标事件驱动不了；本轮走的是"点击物料添加"路径 |

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
