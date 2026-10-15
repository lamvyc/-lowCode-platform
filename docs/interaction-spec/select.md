# select · 下拉选择

> 参考源码：`variant-form/src/components/form-designer/form-widget/field-widget/select-widget.vue`（123 行）
> 物料声明：`widget-panel/widgetsConfig.js:312-362`（`basicFields` 第 6 项）
> **前置阅读**：[00 · 通用字段行为规范](./00-通用字段行为规范.md)（尤其第六章：选项类组件专属通道）

---

## 一、组件身份

| 项 | 值 |
|---|---|
| `type` | `select` |
| 中文名（i18n key） | `designer.widgetLabel.select` |
| 图标 | `select-field` |
| 分组 | `basicFields`（基础字段） |
| `formItemFlag` | `true` |
| `internal` | `false` |
| 类别 | **选项类组件**（有 `initOptionItems`） |
| 特有 ref | `fieldEditor` → `el-select` |

---

## 二、设计态行为

### 2.1 拖入面板后的初始 schema

```json
{
  "type": "select",
  "icon": "select-field",
  "formItemFlag": true,
  "options": {
    "name": "", "label": "", "labelAlign": "",
    "defaultValue": "",
    "placeholder": "",
    "columnWidth": "200px",
    "size": "",
    "labelWidth": null, "labelHidden": false,
    "disabled": false, "hidden": false,
    "clearable": true,
    "filterable": false,
    "allowCreate": false,
    "remote": false,
    "automaticDropdown": false,
    "multiple": false,
    "multipleLimit": 0,
    "optionItems": [
      { "label": "select 1", "value": 1 },
      { "label": "select 2", "value": 2 },
      { "label": "select 3", "value": 3 }
    ],
    "required": false, "requiredHint": "",
    "validation": "", "validationHint": "",
    "customClass": "",
    "labelIconClass": null, "labelIconPosition": "rear", "labelTooltip": null,
    "onCreated": "", "onMounted": "", "onRemoteQuery": "",
    "onChange": "", "onFocus": "", "onBlur": "", "onValidate": ""
  }
}
```

⚠️ **注意 `select` 没有 `readonly`**（Element UI 的 el-select 无只读概念）。
⚠️ `optionItems` 的初始值是**物料配置里的**，不是组件里的——组件本身不设默认选项。
⚠️ `defaultValue` 默认是**空字符串 `''`**，不是 `null`（对比 radio 的 `null`）。

### 2.2 属性面板

| 组 | option | 编辑器 | 备注 |
|---|---|---|---|
| 基础 | `name` / `label` / `labelAlign` | | |
| 基础 | `defaultValue` | **`select-defaultValue-editor`** | ⚠️ 见 2.3 |
| 基础 | `placeholder` | `placeholder-editor` | |
| 基础 | `columnWidth` / `size` / `labelWidth` / `labelHidden` | | |
| 基础 | `disabled` / `hidden` / `clearable` | switch | |
| 基础 | `filterable` | `filterable-editor` | 可搜索 |
| 基础 | `allowCreate` | `allowCreate-editor` | 允许创建新选项 |
| 基础 | `remote` | `remote-editor` | 远程搜索 |
| 基础 | `automaticDropdown` | `automaticDropdown-editor` | 自动展开 |
| 基础 | `multiple` | `multiple-editor` | 多选 |
| 基础 | `multipleLimit` | `multipleLimit-editor` | 多选上限 |
| 基础 | `optionItems` | **`optionItems-editor`** | 见 2.4 |
| 基础 | `required` / `requiredHint` / `validation` / `validationHint` | | |
| 基础 | `customClass` | | 数组 |
| 高级 | `labelIconClass` / `labelIconPosition` / `labelTooltip` | | |
| 事件 | `onCreated` / `onMounted` / **`onRemoteQuery`** / `onChange` / `onFocus` / `onBlur` / `onValidate` | | ⚠️ **没有 `onInput`** |

### 2.3 ⚠️ `defaultValue` 用的是空模板编辑器

`setting-panel/property-editor/field-select/select-defaultValue-editor.vue` 的内容是：

```html
<template>
  <div style="display: none"></div>
</template>
```

**它是一个占位组件——渲染出空 div，什么都不显示。**

为什么？因为 select 有 `optionItems`，所以 `defaultValue-editor.vue` 的
`v-if="!hasConfig('optionItems')"` 判定为假，不渲染。
默认值的编辑被**移到了 `option-items-setting.vue` 里**：

```html
<!-- option-items-setting.vue:3 -->
<el-radio-group v-if="单选 select" v-model="optionModel.defaultValue" @change="emitDefaultValueChange">
  <draggable :list="optionModel.optionItems"> ... </draggable>
</el-radio-group>
<el-checkbox-group v-else-if="多选 select" v-model="optionModel.defaultValue" @change="emitDefaultValueChange">
  ...
</el-checkbox-group>
```

**即：下拉的"默认值"通过在选项列表里勾选来设置**，
单选（`multiple: false`）用 radio，多选（`multiple: true`）用 checkbox。

⚠️ **`multiple` 切换会改变默认值的编辑器形态**：从 radio 切到 checkbox，
`defaultValue` 需要从标量变成数组，但**参考实现不做自动转换**。

### 2.4 选项编辑器（设计态交互）

`option-items-setting.vue` 提供四个操作：

| 按钮 | 行为 |
|---|---|
| `addOption` | push `{ value: optionItems.length + 1, label: 'new option' }` |
| `importOptions` | 打开 textarea 对话框，**导出当前选项为文本**（每行 `value,label`；value===label 时只输出 value） |
| `saveOptions` | 解析 textarea → 整表替换 `optionItems`。分隔符是 **`','`**。空行跳过 |
| `resetDefault` | 多选/checkbox → `defaultValue = []`；其他 → `defaultValue = ''`，并 `emitDefaultValueChange()` |

每个选项行内有：`value` 输入框、`label` 输入框、拖拽把手（`vuedraggable`，组名 `optionsGroup`）、删除按钮。

⚠️ **选项的行内编辑只改 value/label，没有 disabled 的编辑入口**——`disabled` 只能通过 API 设置。

⚠️ 拖拽排序用 `vuedraggable` 的 `:list` 直接改 `optionModel.optionItems`，**原地重排**。

⚠️ `emitDefaultValueChange()` 会去 `designer.formWidget.getWidgetRef(selectedWidget.options.name)`
拿组件实例并调 `refreshDefaultValue()`——**这是设计态改默认值能立刻反映到画布的唯一通道**。
如果组件 `name` 为空，`getWidgetRef` 返回 undefined，**改了默认值画布不会变**（静默）。

---

## 三、运行态行为

### 3.1 模板绑定（逐项）

```html
<el-select ref="fieldEditor" v-model="fieldModel" class="full-width-input"
           :disabled="field.options.disabled"
           :size="field.options.size"
           :clearable="field.options.clearable"
           :filterable="field.options.filterable"
           :allow-create="field.options.allowCreate"
           :default-first-option="allowDefaultFirstOption"      <!-- ⚠️ computed 中转 -->
           :automatic-dropdown="field.options.automaticDropdown"
           :multiple="field.options.multiple"
           :multiple-limit="field.options.multipleLimit"
           :placeholder="field.options.placeholder || i18nt('render.hint.selectPlaceholder')"
           :remote="field.options.remote"
           :remote-method="remoteMethod"                        <!-- ⚠️ computed 中转 -->
           @focus="handleFocusCustomEvent"
           @blur="handleBlurCustomEvent"
           @change="handleChangeEvent">
  <el-option v-for="item in field.options.optionItems"
             :key="item.value" :label="item.label"
             :value="item.value" :disabled="item.disabled" />
</el-select>
```

⚠️ `class="full-width-input"` + `<style>` 里 `width: 100% !important`——
**下拉默认占满父容器宽度**（`columnWidth` 是通过外层容器控制的，不是组件自身）。

### 3.2 ⚠️ 两个 computed 中转（本组件最容易被抄漏的地方）

**① `allowDefaultFirstOption`**

```js
computed: {
  allowDefaultFirstOption() {
    return (!!this.field.options.filterable && !!this.field.options.allowCreate)
  }
}
```

- `:default-first-option` 只在 **`filterable` 且 `allowCreate` 同时为真**时才为 `true`
- 语义：可搜索 + 可创建时，按回车选中第一个匹配项
- ⚠️ **属性面板里没有 `defaultFirstOption` 这个开关**——它是从 `filterable` + `allowCreate` 推导出来的

**② `remoteMethod`**

```js
computed: {
  remoteMethod() {
    if (!!this.field.options.remote && !!this.field.options.onRemoteQuery) {
      return this.remoteQuery
    } else {
      return undefined        // ⚠️ 返回 undefined，不是空函数
    }
  }
}
```

- 只有 **`remote` 为真且配置了 `onRemoteQuery`** 时，才把 `remoteQuery` 方法绑定上去
- 否则绑 `undefined`
- ⚠️ 区别很重要：绑 `undefined` 时 Element 认为"没有远程方法"，
  而绑一个空函数会导致每次输入都发起一次"空查询"

配套的方法：

```js
remoteQuery(keyword) {                              // fieldMixin.js:396
  if (!!this.field.options.onRemoteQuery) {
    new Function('keyword', this.field.options.onRemoteQuery).call(this, keyword)
  }
}
```

### 3.3 事件映射

| DOM 事件 | 处理函数 | 广播 change/formChange | 自定义钩子 |
|---|---|---|---|
| `@change` | `handleChangeEvent(value)` | ✅ | `onChange(value, oldValue)` |
| `@focus` | `handleFocusCustomEvent(event)` | ❌ | `onFocus(event)` |
| `@blur` | `handleBlurCustomEvent(event)` | ❌ | `onBlur(event)` |
| 远程搜索输入 | `remoteQuery(keyword)` | ❌ | `onRemoteQuery(keyword)` |

⚠️ **select 没有 `@input`**（对比 input 组件）。下拉的选中视为 change。
⚠️ **没有 `@clear`**——没有 `onClear` 事件。清空走的是 change（值为 `''` 或 `[]`）。

### 3.4 数据形态

| 场景 | 值的类型 | 默认值 |
|---|---|---|
| 单选（`multiple: false`） | 标量（string / number） | `''` |
| 多选（`multiple: true`） | **数组** | `''` ⚠️ 见下 |
| 清空后（单选） | `''` | |
| 清空后（多选） | `[]` | |

⚠️ **`multiple` 为真但 `defaultValue` 仍是初始的 `''`**——物料配置里两者没有联动。
用户手动把多选打开后，需要在属性面板里重新勾选默认值（走 checkbox 那条分支，会把 `defaultValue` 设成数组）。
**这是参考实现的一个已知不一致点。**

### 3.5 选项类通道（本组件适用）

```js
created() {
  this.initOptionItems()     // ⚠️ 选项类组件在 initFieldModel 之前调用
  ...
}
```

- **设计态**：`initOptionItems()` 第一行就 `return`，**不加载 `optionData`**
- **运行态**：从 `getOptionData()[字段名]` 取值 → `loadOptions(v)` 覆盖 `optionItems`
- 动态刷新：`VFormRender.reloadOptionData(name)` → `broadcast('FieldWidget','reloadOptionItems')`
  → `initOptionItems(true)` → `reloadOptions(v)`（**不清空已选值**）

⚠️ 因为 `loadOptions` / `reloadOptions` 当前实现相同（见通用规范 6.2），
"加载时清空已选值"这个语义**实际上不存在**。

---

## 四、校验语义

沿用通用规范第四章。select 特有的注意点：

1. **`required` 的 `trigger` 只有 `['blur']`** —— 这条对 select 尤其关键。
   源码注释明确写了原因：**change 触发时 `formModel` 尚未更新**，
   对 radio/checkbox/select 这类"点选即赋值"的组件会导致必填校验误报。
2. 因为 select 没有 `@input`，而 `@change` 会调 `dispatch('fieldValidation')` 清错误——
   所以**选中一个值后，必填错误提示会立刻消失**（`validateField` 重新校验，此时值已同步）。
3. `validation` 对 select 的实测意义有限：值通常是数字/字符串，
   内置的 `number` / `email` 等校验器作用于"选中值"而非"显示文本"。
4. 空值（`''` / `[]`）会被内置校验器**直接放过**。

---

## 五、状态语义

| 状态 | 表现 |
|---|---|
| `disabled: true` | 下拉禁用 |
| `hidden: true` | 运行态不渲染，设计态渲染带隐藏图标 |
| `readonly` | **不存在**（物料里没有这个 option） |
| `multipleLimit: 0` | 不限制；`> 0` 时达到上限后其余选项自动禁用 |
| `remote: true` 但没配 `onRemoteQuery` | `remote-method` 绑定为 `undefined`，下拉**不做任何过滤**（选项仍全部显示） |
| `filterable: false` | `allowCreate` 无效（Element 要求可搜索才能创建） |

---

## 六、公开 API（继承 `fieldMixin`）

除通用 API 外，select 是**选项类 API 的主要使用者**：

```js
loadOptions(options)          // 覆盖 optionItems（⚠️ 实际不清空已选值）
reloadOptions(options)        // 同上，当前实现完全相同
getOptions()                  // 返回 optionItems
disableOption(optionValue)    // 按 value 禁用某一项
enableOption(optionValue)     // 按 value 启用某一项
clearSelectedOptions()        // 多选 → []；单选 → ''
getValue() / setValue(v) / resetField()
```

⚠️ `clearSelectedOptions()` 内部判定是：

```js
if (checkbox || (select && multiple)) fieldModel = []
else fieldModel = ''
```

**注意它只改 `fieldModel`，不写 `formModel`**（`fieldMixin.js:512-523`）——
调用后数据源不会同步。这是一个参考实现的缺陷，抄实现时需要决策。

---

## 七、⚠️ 已知坑

| # | 坑 |
|---|---|
| 1 | `default-first-option` 是 computed 推导（`filterable && allowCreate`），属性面板无开关。**最容易抄漏**——静态审计抓不到 computed 中转的绑定 |
| 2 | `remote-method` 在条件不满足时必须绑 `undefined`，不是空函数 |
| 3 | `placeholder` 有 i18n 兜底：`'' \|\| '请选择'`（en: `'Pick some item'`） |
| 4 | 没有 `@input`、没有 `@clear`、没有 `onClear` |
| 5 | `defaultValue` 初始是 `''`，多选打开后**不会自动变成 `[]`** |
| 6 | 默认值通过"选项列表里勾选"设置，用的是隐藏的空编辑器 + `option-items-setting` |
| 7 | `emitDefaultValueChange` 依赖组件 `name` 已设置，否则改默认值无反应 |
| 8 | `importOptions` 的分隔符是英文逗号，选项 label 里含逗号会解析错 |
| 9 | `optionItems` 的 `disabled` 没有设计态编辑入口，只能走 API |
| 10 | `class="full-width-input"` 强制 100% 宽度 |
| 11 | select **没有 `readonly`** |
| 12 | `clearSelectedOptions()` 只改本地值、不写数据源 |

---

## 八、Element UI → Element Plus 差异

| # | Element UI 2.x | Element Plus | 影响 |
|---|---|---|---|
| 1 | `el-option :value` 与 `:label` | 一致 | 无 |
| 2 | `allow-create` | 一致（仍要求 `filterable`） | 无 |
| 3 | `default-first-option` | 一致 | 无 |
| 4 | `remote-method` 回调签名 | 一致 `(query: string)` | 无 |
| 5 | `automatic-dropdown` | 一致 | 无 |
| 6 | `multiple-limit` | 一致 | 无 |
| 7 | `size` 不接受空字符串 | EP 需 `undefined` | 需归一化 |
| 8 | `el-select` 的 `v-model` | EP 支持 `model-value` | 语义一致 |
| 9 | 无（参考无 clear 事件） | EP 有 `clear` 事件 | **不要因为 EP 有就加**，参考没有对应配置项 |
| 10 | `class="full-width-input"` + `!important` | 一致 | 无 |

---

## 九、与本仓库现状的差距

对照 `packages/materials/src/components/Select.vue`（163 行）：

| # | 差距 | 影响 | 优先级 |
|---|---|---|---|
| 1 | **`defaultFirstOption` 完全缺失**（全仓库 grep 0 命中） | 可搜索+可创建时按回车选不中第一项。**这是已确认的功能缺陷，也正是静态审计漏检的典型案例** | 高 |
| 2 | **`remoteMethod` 总是传 `handleRemoteQuery`** | 参考只在 `remote && onRemoteQuery` 时传函数、否则传 `undefined`。本仓库在 `remote: true` 但未配 `onRemoteQuery` 时也挂着一个函数，语义不同 | 高 |
| 3 | **`placeholder` 默认写死 `'请选择'`** | 参考是 `options.placeholder \|\| i18n('render.hint.selectPlaceholder')`，**运行时按语言切换**。本仓库写死，**切到英文仍是"请选择"** | 高 |
| 4 | **多出 `clear` 事件与 `@clear` 绑定** | 参考没有 clear 事件、没有 `onClear` 配置项。多出来会造成事件模型与参考不一致 | 中 |
| 5 | **没有 `onValidate`** | 自定义校验无入口 | 高 |
| 6 | **没有 `onCreated` / `onMounted` / `onRemoteQuery` / `onChange` / `onFocus` / `onBlur`** | 参考的 7 个事件钩子缺失 | 高 |
| 7 | **多出 `options` 别名 prop**（`optionItems` 非空优先） | 参考只有 `optionItems`。双来源会造成 schema 歧义，且导入导出时可能写出参考不认的字段 | 中 |
| 8 | **没有 `initOptionItems` / `optionData` 通道** | 无法通过 `optionData` prop 动态注入选项，也没有 `reloadOptionData` | 高 |
| 9 | **没有 `validation`（内置校验器）** | 9 个内置校验器 + 自定义正则无入口 | 高 |
| 10 | **`size: 'default'` 而非 `''`** | 参考默认 `''`（跟随全局）。本仓库默认 `'default'`，**会覆盖表单级 size 继承** | 中 |
| 11 | **选项 `key` 用 `` `${option.value}` ``** | 参考用 `item.value`。等价（都忽略 label 变化） | 信息性 |
| 12 | **`@update:model-value` 同时绑 `@change`** | EP 的 `ElSelect` 会先触发 `update:model-value` 再触发 `change`，两者都向外 emit。参考只有 `handleChangeEvent` 一条路径 | 中 |

### 已确认的等价项

- `disabled` / `clearable` / `filterable` / `allowCreate` / `remote` / `multiple` / `multipleLimit` 绑定语义一致
- `automaticDropdown` 有额外条件收窄（`multiple || !filterable`）——这是对 EP 的适配，属于**合理改进**，建议登记为有意偏离
- `optionItems` 的 `label` / `value` / `disabled` 透传一致
- 全宽样式一致

---

## 十、验收标准

### 设计态

- [ ] 拖入后 `optionItems` 默认 3 项 `select 1/2/3`
- [ ] 属性面板里默认值编辑是**选项列表勾选**（不是文本框）
- [ ] `multiple` 为假时是单选勾选（radio），为真时是多选勾选（checkbox）
- [ ] `resetDefault` 后：多选 → `[]`，单选 → `''`
- [ ] `importOptions` 导出的文本格式为 `value,label`（value===label 时只输出 value）
- [ ] `saveOptions` 能解析回来，空行被跳过
- [ ] 选项可拖拽排序，重排后顺序持久化
- [ ] **组件 `name` 为空时改默认值，画布不变更**（复现参考行为）
- [ ] 改变 `filterable` 或 `allowCreate` 后，画布行为随之变化（`default-first-option` 推导生效）

### 运行态

- [ ] **未填 `placeholder` 时显示 i18n 的"请选择"（英文环境为 "Pick some item"）**
- [ ] **填了 `placeholder` 时优先显示该文案**
- [ ] `filterable` + `allowCreate` 同时为真时，输入后按回车能选中第一个匹配项
- [ ] 只开 `filterable` 不开 `allowCreate` 时，按回车**不**选中第一项
- [ ] `remote: true` 且配置了 `onRemoteQuery` 时，每次输入调用该函数并传入 keyword
- [ ] `remote: true` 但**未**配置 `onRemoteQuery` 时，输入**不触发任何回调**，选项列表不被过滤
- [ ] `multiple: true` 时值是数组，`multipleLimit: 2` 时选满 2 项后其余选项禁用
- [ ] 选中值后 `formModel` 同步；`formChange` 触发一次
- [ ] 清空后：单选 `''`，多选 `[]`

### 选项类通道

- [ ] 设计态**不加载** `optionData`
- [ ] 运行态 `optionData` 含该字段名时，`optionItems` 被替换为该值
- [ ] `reloadOptionData(name)` 后已选值保持不变
- [ ] `disableOption(v)` / `enableOption(v)` 按 value 生效
- [ ] 异步更新 `optionData` 后能拿到最新值

### 校验

- [ ] `required` 为真时 blur 报错；**选中一个值后错误提示立刻消失**
- [ ] 选值过程中**不**提前报必填错误
- [ ] `validation` 填内置校验器或正则时生效；空值通过

### API

- [ ] `getOptions()` 返回当前 `optionItems`
- [ ] `setValue(v)` 更新显示并同步 `formModel`
- [ ] `resetField()` 恢复为 `defaultValue`
- [ ] `clearSelectedOptions()`：多选 → `[]`，单选 → `''`

---

## 附：参考实现关键行号

| 关注点 | 位置 |
|---|---|
| `allowDefaultFirstOption` computed | `select-widget.vue:73-75` |
| `remoteMethod` computed | `select-widget.vue:77-83` |
| 模板全部绑定 | `select-widget.vue:5-21` |
| `created` 调用顺序（**有** initOptionItems） | `select-widget.vue:90-100` |
| 全宽样式 | `select-widget.vue:119-121` |
| `remoteQuery` 实现 | `fieldMixin.js:396-401` |
| 选项编辑器 | `setting-panel/option-items-setting.vue:3-47` |
| 默认值隐藏编辑器 | `property-editor/field-select/select-defaultValue-editor.vue` |
| 物料初始 options | `widgetsConfig.js:312-362` |
| i18n 兜底文案 | `lang/zh-CN_render.js:9`、`lang/en-US_render.js:9` |
