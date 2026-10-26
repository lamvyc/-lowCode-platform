# 设置面板（组件设置 / 表单设置）

设计器右侧属性面板的实现说明。面板分「组件设置 / 表单设置 / 数据源」三个页签，其中前两个已完整实现。
参考 `variant-form` 的交互组织方式：分区折叠、专用属性编辑器、对话框内编辑代码、即时写回 Schema 并进入撤销栈。

## 一、目录结构

```text
packages/editor/src/designer/
├── components/PropsPanel.vue              # 页签容器：选中组件自动切「组件设置」，取消选中回到「表单设置」
├── components/props/
│   ├── ComponentSettings.vue              # 通用设置 / 高级设置 / 事件设置 三分区折叠
│   ├── FormSettings.vue                   # 基础设置 + 事件设置 + SFC 命名 + 恢复默认
│   ├── PropField.vue                      # 按 PropConfig.control 分派控件
│   ├── NameEditor.vue                     # 唯一名称（重名校验 + label 跟随）
│   ├── StyleEditor.vue                    # 自定义样式（CSS 键值对 → 静态绑定）
│   ├── ExpressionEditor.vue               # 表达式 / 静态值 双模式（Binding）
│   ├── JsonEditor.vue                     # JSON 文本编辑（失焦校验）
│   ├── OptionItemsEditor.vue              # 选项列表增删改排序
│   ├── EventSettings.vue                  # 组件事件列表 + 事件编辑对话框
│   ├── ActionChainEditor.vue              # 动作链结构化编辑
│   ├── CodeEditor.vue                     # 轻量代码编辑器（行号 / Tab / 语法检查）
│   └── CodeDialog.vue                     # 代码对话框（保存前语法校验）
├── props-config.ts                        # 分区推断、联动求值、样式转换、动作选项
├── code.ts                                # 代码校验与格式化（纯函数，可单测）
└── form-css.ts                            # 表单自定义 CSS 注入 document.head
```

## 二、组件设置

### 2.1 分区

`PropConfig.group` 显式声明分区，缺省按控件类型推断（`event` / `events` → 事件设置，其余 → 通用设置）。
空分区不渲染；默认展开「通用设置」与「事件设置」，与参考实现一致。

三个折叠区**按参考实现的属性注册表逐项对齐**（`variant-form`
`setting-panel/propertyRegister.js`）：

| 本仓库分区 | 参考注册表 | 典型属性 |
| --- | --- | --- |
| 通用设置 | `COMMON_PROPERTIES` | `label` / `labelAlign` / `columnWidth` / `size` / `required` / `validation` / `readonly` / `disabled` / `clearable` / `multiple` / `uploadURL` / `class` … |
| 高级设置 | `ADVANCED_PROPERTIES` | `min` / `max` / `precision` / `step` / `controlsPosition` / `minLength` / `maxLength` / `showWordLimit` / `prefixIcon` / `suffixIcon` / `switchWidth` / `activeText` / `range` / `vertical` / `plain` / `labelIconClass` / `labelIconPosition` / `labelTooltip` / `appendButton` … |
| 事件设置 | `EVENT_PROPERTIES` | `onCreated` / `onMounted` / `onInput` / `onChange` / `onClick` / `onRemoteQuery` / `onBeforeUpload` / `onValidate` … |

两条容易写错的规则：

- **校验 / 尺寸 / 标签排版不是高级属性**：`validation`、`validationHint`、`size`、
  `labelWidth`、`labelHidden`、`labelAlign`、`columnWidth` 在参考里都注册在
  `COMMON_PROPERTIES`，因此归「通用设置」；字段类真正属于高级的只有
  `labelIconClass` / `labelIconPosition` / `labelTooltip`，加上各组件自己的
  `min` / `max` / `prefixIcon` / `switchWidth` / `plain` 等。
- **事件设置与参考的事件属性一一对应**：物料 `events[].label` 用 `onXxx` 命名，
  与参考 `EVENT_PROPERTIES` 的键一致；`onCreated` / `onMounted` / `onValidate`
  是「代码型」事件，以 `control: 'code'` 的 `propConfig` 声明并归 `event` 分区。
  参考没有的事件（如 `select` 的 `onClear`）不暴露。

`packages/materials/src/conformance/prop-groups.test.ts` 把参考的三张注册表解析成
机器可读基线，逐 widget 断言「属性分组归属」与「事件一一对应」，防止后续漂移。

### 2.2 控件与专用编辑器

`PropConfig.control` 决定渲染的控件：

| control | 控件 | control | 控件 |
| --- | --- | --- | --- |
| `input` / `textarea` | 文本 / 多行文本 | `radio` / `radio-button` | 单选 / 按钮组 |
| `number` | 数字（支持 `range`） | `checkbox` | 多选 |
| `select` | 下拉 | `color` | 取色器 |
| `switch` | 开关 | `json` | JSON 编辑 |
| `name` | 唯一名称编辑器 | `style` | 自定义样式编辑器 |
| `label` | 标签 | `custom-class` | 自定义类名（取自表单 CSS） |
| `hidden` | 隐藏（写 `meta.hidden`） | `option-items` | 选项列表编辑器 |
| `expression` | 表达式/静态值（Binding） | `code` / `monaco` | 代码对话框 |

- `editor` 字段可覆盖 `control` 的默认渲染，便于物料声明专用编辑器。
- `visibleWhen` 支持 `{ prop, equals / in / notEquals }`，依赖属性缺失时回落到其 `defaultValue`。
- 物料未声明 `propConfigs` 时回落到 `propertySchema`（JSON Schema → PropConfig，支持 `x-control` / `x-group` / `x-placeholder`）。

### 2.3 节点级系统属性

`name` / `label` / `hidden` / `style` / `class` 不是组件 props，而是节点身份与节点级配置，由面板分派专用编辑器：

- **唯一名称**：全局去重，重名提示并回滚；`label` 仍等于旧名称时跟随更新。
- **自定义样式**：面板接受普通 CSS 键值对，写入前包装为 `{ type: 'static', value }`——运行时只识别 `Binding`，直接写裸值不会生效。
- **自定义类名**：写 `props.class`，经 Vue 透传到物料根元素；候选类名来自「表单设置」的自定义 CSS。

### 2.4 事件设置

物料通过 `Material.events` 声明支持的事件（名称、展示名、回调参数、说明）；节点上额外的自定义事件也会列出。
点击「添加/编辑动作」打开对话框，用结构化方式编辑 `node.events[eventName]`（动作链）：

- 每条动作：动作类型（`ActionKind`）、执行条件表达式、延迟、参数 JSON；
- 「动作参数」是 JSON 文本：输入过程中保留本地草稿（否则受控 `el-input` 会把每次按键
  回滚成旧值），JSON 合法时即时写回，失焦时校验并格式化为两空格缩进；
- 支持新增 / 删除 / 上下移；空动作链视为解绑该事件；
- 写回走 `EditorEngine.updateEvents`，进入撤销栈。

## 三、表单设置

表单级配置存储在 `PageSchema.settings.form`（`FormSettings`，`@lowcode/schema` 提供默认值与归一化）：

| 字段 | 说明 | 生效位置 |
| --- | --- | --- |
| `size` / `labelPosition` / `labelAlign` / `labelWidth` | 表单排版 | 代码生成 / 外部消费者 |
| `cssCode` | 自定义 CSS | 即时注入画布 `<head>`（`useFormCss`） |
| `customClass` | 表单类名 | 代码生成 |
| `functions` | 全局函数 | 代码生成 |
| `modelName` / `refName` / `rulesName` | SFC 变量命名 | 代码生成 |
| `onFormCreated` / `onFormMounted` / `onFormDataChange` | 表单事件函数体 | 代码生成 |

- 「表单 CSS」与「全局函数」通过代码对话框编辑；表单事件按 `FORM_EVENT_CONFIGS` 声明渲染，对话框头部展示函数签名。
- 保存前 `CodeEditor.getEditorAnnotations()` 做语法检查（JS 用 `new Function` 解析、JSON 用 `JSON.parse`、CSS 查花括号配平），有错误则提示并阻止保存。
- 「恢复默认设置」清空 `settings.form`，面板回落默认值。
- 所有写入经 `EditorEngine.updateFormSettings`（`mergeKey = formSettings`），连续输入合并为一条历史。

## 四、扩展一个物料

```ts
{
  type: 'rate',
  name: '评分',
  category: '表单',
  version: '1.0.0',
  component: Rate,
  events: [{ name: 'change', label: 'onChange', params: ['value'], description: '评分变化时触发' }],
  defaultProps: { modelValue: 0, max: 5, allowHalf: false },
  propConfigs: [
    { name: 'name', label: '唯一名称', control: 'name', group: 'common' },
    { name: 'hidden', label: '隐藏', control: 'hidden', group: 'common' },
    { name: 'class', label: '自定义类名', control: 'custom-class', group: 'common' },
    { name: 'max', label: '最大分值', control: 'number', group: 'advanced', range: { min: 1, max: 10 } },
    { name: 'allowHalf', label: '允许半星', control: 'switch', group: 'advanced' },
    { name: 'style', label: '自定义样式', control: 'style', group: 'advanced' },
  ],
}
```

新增 `PropControlType` 时，在 `PropField.vue` 增加一个分支并同步 `@lowcode/schema` 的类型联合即可，无需改动引擎。

## 五、验证

- 单测：`props-config.test.ts`（分区 / 联动 / 样式转换 / JSON Schema 兜底）、`code.test.ts`（语法校验）、
  `packages/schema/src/form-settings.test.ts`（默认值 / CSS 类名提取）、`editor-engine.test.ts`（表单设置历史合并与撤销）、
  `packages/materials/src/conformance/prop-groups.test.ts`（与参考的属性分组 / 事件属性对齐）。
- 浏览器交互（无头 Chrome + CDP）：页签自动切换、分区渲染、选项增删、属性联动、样式即时生效、事件动作链写回与撤销、代码对话框语法拦截、表单 CSS 注入与回写。
