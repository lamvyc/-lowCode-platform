# 生成 SFC（纯 Element Plus）设计

> 状态：已确认（2026-10-24，方向 B + 5 项产品取舍均已拍板）
> 范围：`@lowcode/codegen` 重写生成层 + `SfcDialog` 配套 + 测试/文档
> 相关：`docs/designer-ui.md`、`docs/architecture.md`（两条执行路径须一致）

## 1. 背景与意图

当前工具栏「生成 SFC」走 `packages/codegen/src/generator.ts`：把 Schema 节点映射成
`@lowcode/materials` 的 `Lc*` 组件。它只能算一个骨架，离"完备"有系统性差距：

- 没有表单壳：`settings.form`（labelWidth / labelPosition / labelAlign / size /
  cssCode / functions / modelName / refName / rulesName / 表单事件）完全没进生成物；
- 没有校验：`required` / `validation` 只当属性输出，`schema.rules` 被忽略；
- 动作只实现 6 种，`setProp` 写入的 `propsOverride` 从未被模板消费；
- 具名插槽丢失；`customClass` 不会变成 class；循环没有 `:key`；
- `style` 的 kebab-case 键会生成非法 JS；数据源只支持"GET 一个 URL"；
- `alert` 物料未导出/未映射，生成时降级成注释。

用户已明确选择方向 **B：输出纯 Element Plus 的独立 SFC**，不再依赖
`@lowcode/materials`。本设计把"完备"定义为：**生成物可被拷进一个只装了
`vue` + `element-plus` 的 Vue 3 工程直接运行**，并复现 Schema 的结构、表单设置、
校验、事件动作与数据源行为。

## 2. 目标 / 非目标

### 目标

1. 34 个内置物料都有确定、可测试的 Element Plus 映射，不再出现"未注册物料"。
2. 生成物包含：表单壳与表单设置、字段初始值、校验规则、事件处理器、动作链、
   数据源加载、生命周期钩子、表单事件、页面变量、自定义函数/CSS。
3. **依赖契约**：核心依赖只有 `vue` + `element-plus`，不出现任何 `@lowcode/*`。
   - 用了图标属性时，按需从 `@element-plus/icons-vue` 导入（官方配套包）；
   - 用了富文本时，从 `@vueup/vue-quill` 导入（与画布同一个编辑器，能力一致）。
   - 生成物文件头会写明本页实际需要的依赖与安装命令。
4. 覆盖 12 个内置页面模板：生成 → SFC 编译 → 真实挂载 → 交互断言。
5. 生成物经过 Prettier 格式化，保持可读；未支持的能力以**警告**形式显式暴露，
   不静默丢节点。

### 非目标

- 不追求 34 个组件与画布**逐像素**一致；保证表单排版、栅格、表格、卡片、标签页、
  按钮等主要视觉结构一致（见 §6 样式）。
- 不生成 `@lowcode/runtime` 的规则引擎 / 权限 / 流程 / 弹窗系统；
  `DataModel`/`API` 数据源、`custom` 动作等无法独立运行的项给 warning。
- 不改 runtime / materials 的行为（本设计只动 codegen 与 SFC 对话框）。

## 3. 输出契约

```vue
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElForm, ElFormItem, ElInput, ElButton } from 'element-plus'

const formData = reactive({ input1: '', switch1: true })
const formRef = ref()
const formRules = {
  input1: [{ required: true, message: '字段值不可为空', trigger: ['blur', 'change'] }],
}

function onClickButton1(event) { /* 动作链 */ }

onMounted(() => { /* 数据源 + onMounted */ })
</script>

<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    label-position="left"
    label-width="150px"
    size="default"
    class="lc-page"
    @submit.prevent
  >
    <el-form-item label="发件人姓名" prop="input1">
      <el-input v-model="formData.input1" clearable placeholder="请输入" />
    </el-form-item>
    <el-button type="primary" @click="onClickButton1">提交</el-button>
  </el-form>
</template>

<style scoped>
/* §6 的排版基线 + 节点 style / customClass */
</style>
```

- `<script setup lang="ts">`；根节点为 `<el-form>`（页面没有可提交表单时退化为 `<div class="lc-page">`）。
- 数据键 = `node.name ?? sanitize(node.id)`；`modelName/refName/rulesName` 取表单设置。
- 组件按需导入，不整包 import。

## 4. 架构

### 4.1 管线

```
Schema
  → buildPlan(schema)               // 解析表单设置/数据源/字段/事件/规则，收集 warning
  → 表单壳 + 节点 AST              // 每个节点由 ElementMapping 生成
  → buildScript(plan)              // setup：data/rules/actions/datasources/hooks
  → buildStyle(plan)               // 排版基线 + cssCode + 节点 style
  → Prettier(vue)
  → GeneratedCode { code, template, script, style, warnings }
```

### 4.2 映射注册表

新增数据驱动的映射层（替代当前写死的 `DEFAULT_MATERIALS`）：

```ts
export interface ElementMapping {
  /** 输出标签，如 'el-input' | 'div' */
  tag: string
  /** 是否包 <el-form-item>；字段为 true */
  field?: boolean
  /** 属性名转换：schema prop → 目标标签属性；返回 undefined 表示丢弃 */
  attrs?: (node: PageNode, ctx: MappingContext) => Record<string, string>
  /** 插槽 / 子节点渲染方式 */
  slot?: 'default' | 'none' | ((node, ctx) => TemplateNode[])
  /** 该物料默认值类型（[] / '' / false / null），用于 formData 初始化 */
  initialValue?: (node: PageNode) => unknown
  /** 额外生成 setup 代码（如 tab 的 active、upload 的 fileList） */
  setup?: (node: PageNode, ctx: MappingContext) => string[]
  /** 表单校验规则 */
  rules?: (node: PageNode, ctx: MappingContext) => string[]
  /** 特殊渲染（布局表格、数据表格、富文本等） */
  render?: (node: PageNode, ctx: MappingContext) => TemplateNode
}

export interface MappingRegistry {
  register(type: string, mapping: ElementMapping): void
  get(type: string): ElementMapping | undefined
  /** 自定义物料的组件导入逃生口（保留旧 materials 模式） */
  registerComponent(type: string, entry: { tag: string; importName: string; from: string }): void
}
```

内置 34 个物料注册在 `packages/codegen/src/mappings/`，每个文件一组；插件可注册扩展物料。

### 4.3 表单壳

- 字段集合 = 映射表里 `field: true` 的节点（**按类型判定**，不依赖 `'modelValue' in props`）。
  理由：模板 / 导入 JSON 经常省略 `modelValue`，runtime 靠 `EditorEngine.load` 注入默认值才
  成为字段；codegen 是公开 API，必须对"没经过 editor 规范化"的 Schema 也成立。
  `mapping.initialValue` 提供缺省值，因此不需要把 `@lowcode/materials` 拉进 codegen。
- 有字段时根节点 `<el-form>`；`ref` / `:model` / `:rules` 用表单设置里的名字
  （默认 `formRef` / `formData` / `formRules`），名字经合法标识符处理。
- `label-position`、`label-width`（数值 → `px`）、`size`、`class`（表单 `customClass`）。
- 每个字段包 `<el-form-item :label :prop>`；`labelHidden` → `label-width="0"` 且不渲染 label；
  `labelWidth` 逐字段覆盖；`labelAlign` 生成 `lc-label-{left|center|right}` 类 + scoped CSS。
- `labelIconClass` / `labelTooltip` 生成 `#label` 插槽（图标 + tooltip），与物料外壳一致。
- 字段节点的 `v-if` / `v-for` / `style` / `class` 放在 `el-form-item` 上；组件节点的放在标签本身。
- 表单事件：
  - `onFormCreated`：setup 末尾执行（`try/catch`）。
  - `onFormMounted`：`onMounted` 内执行。
  - `onFormDataChange`：每个字段生成 `watch(() => formData.x, (nv, ov) => handler('x', nv, ov, formData))`。
- `functions` 原样注入 setup（保留用户函数，供事件/动作调用）。

### 4.4 校验

- 从字段 props 生成 Element Plus `rules`：
  - `required` → `{ required: true, message: requiredHint || '字段值不可为空', trigger: ['blur','change'] }`
  - `validation` 命中内置名 → 生成 `pattern: /.../`；否则按正则字符串生成；
    `message: validationHint || 内置默认文案`；正则非法 → warning 并跳过。
    内置名/文案复制自 `@lowcode/core` 的 `BUILTIN_PATTERNS`（codegen 不新增运行时依赖），
    并用一个单测与 core 的导出一致性对表，防止漂移。
  - `maxLength/minLength` → `min/max` 规则（按字符串/数组长度）。
- `schema.rules`：
  - `trigger: 'mount'` → onMounted 执行一次；
  - `trigger: 'expression'` → 对 formData/数据源做 `watch(..., { deep: true })`，条件命中执行动作（防抖 `debounceMs`）；
  - `trigger: 'event'` → 每个事件处理器末尾执行一次；
  - `datasource` → 数据源加载后执行。
  - 条件表达式用 §4.8 的脚本模式求值。
- 提交：`submit` 动作调用 `formRef.validate()`；成功派发 `window` 的 `lc-submit`
  CustomEvent（detail = formData 的深拷贝），失败聚焦第一个错误。

### 4.5 初始值

- 字段初始值取 `props.modelValue`；缺失时用映射的 `initialValue` 回落：
  `checkbox / select(multiple) / date-range / time-range / picture-upload / file-upload → []`，
  `switch → false`，`slider → 0`，其余 → `''` 或 `null`（与物料 defaultProps 对齐）。
- 非字段节点不写进 formData。
- 字段名非法标识符时转成合法 key，并在 warning 中提示。
- 旧版按钮别名：`label ?? text ?? '按钮'`（见 §4.10 的模板修复）。

### 4.6 动作链

`runAction(action, payload)` 生成完整 switch：

| kind | 生成行为 |
| --- | --- |
| `setProp` | `nodeOverrides[nodeId][prop] = value`；模板每个组件都 `v-bind="nodeOverrides[nodeId]"`，表单 item 的 label/required 也从 overrides 读取 |
| `setVariable` | `variables[name].value = value`（支持 `config.expression`） |
| `openDialog` / `closeDialog` | `dialogs[id] = true/false`；独立页没有弹窗物料 → warning |
| `emitEvent` | `window.dispatchEvent(new CustomEvent(name, { detail: payload }))` |
| `request` | `fetch(url, { method, headers, body })`，结果写入 `requestResult`；带 `dataSourceId` 时走数据源加载 |
| `navigate` | `location.href = route`（hash 路由保留 hash 形式） |
| `submit` | 校验 + 派发 `lc-submit` |
| `refresh` | 重新加载指定数据源 |
| `custom` | `console.warn('[codegen] 独立页面无法执行自定义动作', actionId)` |

- 事件处理器签名 `(payload) => void`，按事件实际载荷传入（input/change 传值，click 传 event）。
- `when` 条件在脚本模式求值（§4.8）；条件为假跳过该动作。
- 每个动作包 `try/catch`，失败 `console.warn` 不中断后续动作。

### 4.7 数据源

| type | 生成 |
| --- | --- |
| `static` | `const x = ref(staticData)` |
| `rest` | `const x = ref(null)`；`loadX()`：fetch(url, { method, headers, params 拼 query })，结果整体写入 `x.value` |
| `localStorage` / `sessionStorage` | 读取并 JSON.parse 写入 `x`；失败给 warning |
| `pageVariable` | 复用页面变量的 ref |
| `DataModel` / `API` | warning + `ref(null)`（独立页无法解析平台模型） |

- **运行时语义对齐**：`$datasource.x` 就是加载到的 payload（`DataSourceManager.getAllData()`
  返回 `{[id]: state.data}`），`.data` 是 payload 自己的属性，生成器**不拆也不重命名**。
  因此不存在 `xState` 这种表达式别名；加载状态只作为内部变量（可选）用于调试。
- `autoLoad !== false` 时在 `onMounted` 调 `loadX()`；`pollInterval` 生成 `setInterval` 并在 `onBeforeUnmount` 清理。

### 4.8 表达式

- 模板表达式：`$datasource.x` → `x`（ref 自动解包，`.data` 原样保留）、`$page.v` → `v`。
- 脚本表达式：`$datasource.x` → `x.value`、`$page.v` → `v.value`。
- 例：`count($datasource.userList.data)` 模板 → `count(userList?.data)`；脚本 → `count(userList.value?.data)`；
  `$datasource.userList.length` 两模式同理保留 `.length`。
- 生成一组与 core 对齐的辅助函数：`count / isEmpty / contains / toUpper / toLower /
  round / floor / ceil / join`，供模板与脚本使用。
- 动作 config 中的 `expression` 用 `new Function` + `with(ctx)` 求值（用户代码，允许）；
  Jexl 专有语法无法转换时 warning。

### 4.9 样式

- 节点 `style` → `:style="{ 'prop': expr }"`，键用 JSON 字符串（修 kebab-case 非法 JS），
  静态字符串用 `JSON.stringify` 转义。
- 自定义类名取自 `node.props.class`（平台实际存储位置，不是 `customClass`），与映射自带的
  class 合并成数组绑定。
- `<style scoped>` 生成一套排版基线（从物料实现抽取、按需）：
  - 表单 item 间距 / label 高 / 控件高（FormItem.vue 的对齐值）；
  - 按钮默认档字号/padding/圆角（Button.vue）；
  - 卡片 header padding / margin；栅格 min-height；布局表格边框；标签页 margin；
  - 图片/提示/上传的少量布局。
- `settings.form.cssCode` 放入非 scoped `<style>`（与原实现一致，允许覆盖 Element Plus 内部类）。
- `style` tab 内容 = 排版基线 + cssCode。

### 4.10 未知物料、warnings 与图标

- **warnings 边界**：凡是"生成器知道无法 1:1 还原"的能力，都进 `GeneratedCode.warnings`
  （SFC 对话框展示），**不**只写在生成文件的 console：
  - 未知物料 / 自定义物料缺映射；
  - `DataModel` / `API` 数据源、`custom` 动作、`openDialog/closeDialog`；
  - 非法正则、无法转换的 Jexl 表达式；
  - `props.hidden`（编辑器专用）与图标字体类 `labelIconClass` 在独立页无对应物；
  - 旧版 `table + columns` 归一化为 `data-table`（见 §5）。
  同一条消息去重；生成文件内只对**运行期**失败（动作异常）`console.warn`。
- **图标策略**：`button.icon` / `input.prefixIcon` / `suffixIcon` 是 Element Plus 图标组件名
  （如 `Search`）。生成器按需从 `@element-plus/icons-vue` 导入并绑定组件；字符串形如
  `el-icon-*` 或该包不存在的名字 → 丢弃并 warning。`labelIconClass`（图标字体 class）
  在独立页无字体，丢弃并 warning。
- **旧版按钮别名**：`label ?? text ?? '按钮'`；同时在模板/规范化层把 `text` 迁移为 `label`
  （见 §9），避免 `applyMaterialDefaults` 注入默认 `label` 后把 `text` 遮掉。
- 未知 type → `<!-- 未注册物料: type -->` + warning，不损坏整页。
- 自定义物料通过 `MappingRegistry.register` 注册；仍想复用平台组件时用
  `registerComponent(type, { tag, importName, from })` 逃生口（默认不启用）。
- `SfcDialog` 展示 warnings（黄色 alert 列表），并在复制/下载时保留注释。

## 5. 物料映射矩阵（34）

| type | 目标 | 包装 | 关键映射 / 特殊处理 |
| --- | --- | --- | --- |
| card | `el-card` | 容器 | header 插槽放 label + 折叠按钮；collapsed 状态；children → default |
| grid | `el-row` | 容器 | gutter / justify；colHeight → CSS 变量下传 |
| grid-col | `el-col` | 容器 | responsive ? `:md/:sm/:xs` : `:span`；offset/push/pull；height |
| table | `div > table > tbody` | 容器 | border 类；children → tr；只表示布局表格 |
| table-row | `tr` | 内部 | children → td |
| table-cell | `td` | 内部 | colspan/rowspan；cellWidth/Height → style；wordBreak |
| tab | `el-tabs` | 容器 | `v-model` active；activeName 或第一个 pane；children |
| tab-pane | `el-tab-pane` | 内部 | label / name / disabled；active → 默认激活 |
| text | `div.lc-text` | 基础 | text / color / fontSize / bold / align |
| static-text | `div.lc-static-text` | 基础 | textContent / textAlign / fontSize / preWrap / columnWidth |
| html-text | `div` | 基础 | `v-html` |
| button | `el-button` | 基础 | label/type/size/plain/round/circle/disabled；displayStyle → style；@click |
| divider | `el-divider` | 基础 | direction/contentPosition；label → default 插槽 |
| image | `el-image` | 基础 | src/alt/width/height；fit |
| alert | `el-alert` | 基础 | title/type/description/closable/closeText/center/showIcon/effect；@close |
| input | `el-input` | 字段 | 含 appendButton 插槽；min/maxlength、showWordLimit、prefix/suffix |
| textarea | `el-input type=textarea` | 字段 | rows |
| number | `el-input-number` | 字段 | min/max/precision/step/controlsPosition |
| radio | `el-radio-group` | 字段 | optionItems → el-radio / el-radio-button；buttonStyle/border/displayStyle |
| checkbox | `el-checkbox-group` | 字段 | 同上 |
| select | `el-select` | 字段 | optionItems → el-option；multiple/filterable/allowCreate/limit |
| time | `el-time-picker` | 字段 | format/valueFormat |
| time-range | `el-time-picker is-range` | 字段 | start/end placeholder |
| date | `el-date-picker` | 字段 | type/format/valueFormat |
| date-range | `el-date-picker is-range` | 字段 | 同上 |
| switch | `el-switch` | 字段 | active/inactive text/color、width |
| rate | `el-rate` | 字段 | max/allowHalf/low/high threshold/showText/showScore |
| color | `el-color-picker` | 字段 | showAlpha |
| slider | `el-slider` | 字段 | min/max/step/range/showStops/vertical/height |
| cascader | `el-cascader` | 字段 | optionItems → options；multiple/checkStrictly/showAllLevels |
| picture-upload | `el-upload` | 字段 | picture-card；fileList 状态、before-upload 大小/类型、on-success/on-remove、limit |
| file-upload | `el-upload` | 字段 | 文本列表；其余同上 |
| rich-editor | `QuillEditor` | 字段 | 从 `@vueup/vue-quill` 导入（与画布同一个编辑器）；`v-model:content` + `content-type="html"` + 工具栏配置 |
| data-table | `el-table` | 基础 | columns → `el-table-column v-for`；data 表达式；stripe/border |

两条数据修复（属于本计划的先行任务）：

- **table vs data-table**：`table` 只表示布局表格。「数据列表页」模板与历史页面里
  `type: 'table'` + `columns`/`data` 的写法是历史 bug（runtime 里 LcLayoutTable 会忽略这两个
  prop，渲染成空表）。计划把模板改成 `data-table`，并在 `normalizePageSchema` 里加一条
  归一化：`type === 'table'` 且存在 `columns` 或 `data` → `type = 'data-table'`。
- **button text 别名**：登录 / 数据列表模板用 `text`，但 `EditorEngine.load` 会注入 manifest
  默认 `label: '按钮'`，把 `text` 遮掉。计划把模板改用 `label`，并在归一化里补
  `if (type === 'button' && props.text && (props.label === undefined || props.label === '')) props.label = props.text`；
  codegen 侧同时保留 `label ?? text ?? '按钮'` 兜底。

## 6. 样式基线（不逐像素）

生成物包含从物料实现抽取的排版基线，覆盖：

- 表单：item `margin-bottom: 22px`、label 字号 14 / 行高 36 / padding-right 12、
  控件高 36、错误文案字号；
- 按钮：默认档 12px 字号、`9px 15px` padding、3px 圆角；
- 卡片：`margin: 3px`、header `10px 12px`、body 最小高；
- 栅格：`min-height: 50px`；布局表格 1px 实线边框、单元格 36px；
- 标签页：外层 2px margin；上传/图片的基础间距。

复杂组件（富文本、上传、数据表格）只保证结构/交互，不承诺与画布完全一致。

## 7. 分阶段实施

### P0 骨架 + 表单 + 常用字段/容器（10/12 模板）

- 前置数据修复：`table + columns/data → data-table`、`button.text → label`；
- MappingRegistry、表单壳、数据模型、校验、样式基线、表达式重写；
- 容器：card/grid/grid-col/table/table-row/table-cell/tab/tab-pane；
- 基础：text/static-text/html-text/button/divider/image/alert；
- 字段：input/textarea/number/radio/checkbox/select/switch/date/date-range/time/time-range/rate/color/slider/cascader；
- 语料：除「固定表格表单」（需 picture-upload）与「数据列表页」（需 data-table）外的 10 个模板。

### P1 高级组件 + 细节（12/12 模板）

- picture-upload/file-upload/rich-editor/data-table；
- 具名插槽、`props.class`、style 转义、loop key；
- 表单事件、form functions/cssCode；
- 语料补到 12/12。

### P2 行为完备

- 动作全集（setProp/overrides、setVariable、submit、refresh、request、navigate、emitEvent）；
- 数据源全类型；表达式辅助函数；schema.rules；
- 生命周期钩子 onValidate 等。

### P3 收尾

- SfcDialog warnings UI；文档更新；旧测试迁移；
- 性能：只 import 用到的组件（按 AST 收集）。

每阶段以"测试通过 + 当前覆盖的模板回归"为完成条件。

## 8. 验证

1. **单元（codegen）**：每个物料一个用例：代表 props 生成预期标签/属性/子节点；
   parse + compile 无错；未知物料 warning；style key 转义；loop key。
2. **集成（editor）**：生成 SFC → `compileScript` + `compileTemplate` → 在 happy-dom
   里用真实 `element-plus` 挂载；断言标签、label、v-model 初始值；
   模拟输入触发校验；执行 click 动作断言变量/overrides 变化。
3. **模板语料**：12 个内置模板分别用 **原始 `template.create()`** 与 **`EditorEngine.load`
   规范化后**的 Schema 各生成一遍；断言无 `未注册物料`、无 `@lowcode/` import、
   字段数一致（原始 schema 缺 `modelValue` 也必须按类型识别为字段）。
4. **真机**：SFC 对话框打开模板页 → 四个 tab 有内容 → warnings 正确 → 下载文件可解析；
   可选：把生成物写入 playground fixture 用 Vite 真正跑起来。
5. 回归：`pnpm -r test`、`pnpm -r typecheck`、`pnpm verify:browser --only dialog-drag`。

## 9. 兼容与迁移

- `GeneratedCode` 新增 `warnings: string[]`；SfcDialog 展示。
- 旧 `VueSfcGenerator({ materials })` 行为改为"自定义组件逃生口"；默认输出 Element Plus。
- **Schema 归一化**（`normalizePageSchema`）：`table + columns/data` → `data-table`；
  `button.text` → `label`（仅当 label 缺失）。两处都要有单测，且先于 codegen 改动落地，
  这样 runtime 与 codegen 看到的是同一份语义。
- 模板：`templates.ts` 的「数据列表页」`table` → `data-table`；登录/数据列表按钮 `text` → `label`。
- 现有 codegen 测试更新：删除 `@lowcode/materials` 断言，改为 Element Plus 标签断言；
  新增 34 物料矩阵测试。
- `packages/editor/src/integration/generated-runs.test.ts` 依赖旧的 `generateVueSfc` 输出与
  `@lowcode/materials` 注册，作为迁移的一部分重写为"纯 Element Plus 挂载"。
- 文档 `docs/designer-ui.md` 第六节改写；`docs/material-library.md` 的"生成 SFC 含 35 个物料导入"更新。

## 10. 评审结论（我的决定）

独立评审提出的 5 个歧义，按下面处理（不阻塞开工）：

1. `$datasource` 采用 **runtime 语义**：`$datasource.x` = payload，`.data` 原样保留；
   删除设计里的 `xState` 表达式别名；模板/脚本只差 ref 解包（见 §4.7/§4.8）。
2. 字段判定改为 **映射表 `field: true`（按类型）**，不依赖 `modelValue` 是否存在；
   初始值走 `mapping.initialValue`，codegen 不引入 `@lowcode/materials`。
   语料同时覆盖原始与 editor 规范化后的 Schema。
3. `table` 只做布局表格；「数据列表页」模板改 `data-table`，并在
   `normalizePageSchema` 里把历史 `table + columns/data` 归一化为 `data-table`。
4. 按钮 `text` 别名：模板改 `label`，归一化补 `label = text`，codegen 保留兜底。
5. warnings 边界与图标策略见 §4.10：无法 1:1 还原的能力进 `warnings`；图标只支持
   Element Plus 图标组件名，按需从 `@element-plus/icons-vue` 导入，其余丢弃并 warning。

## 11. 已确认的产品取舍

1. **富文本**：生成物使用 `@vueup/vue-quill`（与画布一致，额外依赖一个包）。
2. **上传**：`uploadURL` 为空时走本地 object URL（与 runtime 一致）。
3. **DataModel/API 数据源、custom 动作、openDialog**：独立页无法还原，按 warning 处理。
4. **像素级**：只保证 §6 的排版基线，复杂组件不逐像素。
5. **表单事件**：生成页按本设计的语义实现；runtime 同步留作独立任务，不在本次范围。
