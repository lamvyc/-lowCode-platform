# radio · 单选组

> 参考源码：`variant-form/src/components/form-designer/form-widget/field-widget/radio-widget.vue`（105 行）
> 物料声明：`widget-panel/widgetsConfig.js:232-281`（`basicFields` 第 4 项）
> **前置阅读**：[00 · 通用字段行为规范](./00-通用字段行为规范.md)（尤其第六章：选项类组件专属通道）

---

## 一、组件身份

| 项 | 值 |
|---|---|
| `type` | `radio` |
| 中文名（i18n key） | `designer.widgetLabel.radio` |
| 图标 | `radio-field` |
| 分组 | `basicFields`（基础字段） |
| `formItemFlag` | `true` |
| `internal` | `false` |
| 类别 | **选项类组件**（有 `initOptionItems`） |
| 特有 ref | `fieldEditor` → `el-radio-group` |

---

## 二、设计态行为

### 2.1 拖入面板后的初始 schema

```json
{
  "type": "radio",
  "icon": "radio-field",
  "formItemFlag": true,
  "options": {
    "name": "", "label": "", "labelAlign": "",
    "defaultValue": null,
    "columnWidth": "200px",
    "size": "",
    "displayStyle": "inline",
    "buttonStyle": false,
    "border": false,
    "labelWidth": null, "labelHidden": false,
    "disabled": false, "hidden": false,
    "optionItems": [
      { "label": "radio 1", "value": 1 },
      { "label": "radio 2", "value": 2 },
      { "label": "radio 3", "value": 3 }
    ],
    "required": false, "requiredHint": "",
    "validation": "", "validationHint": "",
    "customClass": "",
    "labelIconClass": null, "labelIconPosition": "rear", "labelTooltip": null,
    "onCreated": "", "onMounted": "", "onChange": "", "onValidate": ""
  }
}
```

⚠️ **`defaultValue` 默认是 `null`**（对比 select 的 `''`）。
⚠️ **radio 没有 `placeholder`、没有 `readonly`、没有 `clearable`**。
⚠️ 事件只有 4 个：`onCreated` / `onMounted` / `onChange` / `onValidate`。
**没有 `onFocus` / `onBlur` / `onInput`**（模板里也只监听了 `@change`）。

### 2.2 属性面板

| 组 | option | 编辑器 | 备注 |
|---|---|---|---|
| 基础 | `name` / `label` / `labelAlign` | | |
| 基础 | `defaultValue` | **`radio-defaultValue-editor`** | ⚠️ 空模板占位，见 2.3 |
| 基础 | `columnWidth` / `size` / `labelWidth` / `labelHidden` | | |
| 基础 | `displayStyle` | `displayStyle-editor` | `inline` / `block` |
| 基础 | `buttonStyle` | `buttonStyle-editor` | switch，按钮样式 |
| 基础 | `border` | `border-editor` | switch |
| 基础 | `disabled` / `hidden` | switch | |
| 基础 | `optionItems` | `optionItems-editor` | 见 2.4 |
| 基础 | `required` / `requiredHint` / `validation` / `validationHint` | | |
| 基础 | `customClass` | | 数组 |
| 高级 | `labelIconClass` / `labelIconPosition` / `labelTooltip` | | |
| 事件 | `onCreated` / `onMounted` / `onChange` / `onValidate` | | ⚠️ 仅 4 个 |

⚠️ **没有 `readonly` 编辑器**——radio 是点选控件，参考实现不提供只读态。

### 2.3 ⚠️ `defaultValue` 用的是空模板编辑器

和 select 同理：`property-editor/field-radio/radio-defaultValue-editor.vue` 内容是

```html
<template>
  <div style="display: none"></div>
</template>
```

因为 radio 有 `optionItems`，`defaultValue-editor.vue` 的 `v-if="!hasConfig('optionItems')"` 为假。

**默认值改为在 `option-items-setting.vue` 的选项列表里勾选**：

```html
<!-- option-items-setting.vue:3-17 -->
<el-radio-group v-if="(type === 'radio') || (type === 'select' && !multiple)"
                v-model="optionModel.defaultValue" @change="emitDefaultValueChange">
  <draggable tag="ul" :list="optionModel.optionItems"
             v-bind="{ group: 'optionsGroup', ghostClass: 'ghost', handle: '.drag-option' }">
    <li v-for="(option, idx) in optionModel.optionItems" :key="idx">
      <el-radio :label="option.value">
        <el-input v-model="option.value" size="mini" style="width: 100px" />
        <el-input v-model="option.label" size="mini" style="width: 100px" />
        <i class="iconfont icon-drag drag-option"></i>
        <el-button circle plain size="mini" type="danger" @click="deleteOption(option, idx)"
                   icon="el-icon-minus" class="col-delete-button" />
      </el-radio>
    </li>
  </draggable>
</el-radio-group>
```

⚠️ **注意编辑器内部用 `el-radio :label`**（Element UI 语义：`label` 即选项值）。
Element Plus 已改为 `:value`，`:label` 仅作显示文本——**迁移时这里必须改，否则勾选逻辑会错**。

### 2.4 ⚠️ `resetDefault` 会把 `null` 变成 `''`

```js
resetDefault() {                                   // option-items-setting.vue:180
  if (checkbox || (select && multiple)) {
    this.optionModel.defaultValue = []
  } else {
    this.optionModel.defaultValue = ''             // ⚠️ radio 走这条
  }
  this.emitDefaultValueChange()
}
```

**radio 的初始 `defaultValue` 是 `null`，但点"重置默认值"后变成 `''`。**
两个"空值"语义不同（`null` 表示未选中；`''` 是一个合法的空字符串值）。
**这是参考实现的不一致点**，抄实现时需明确决策：跟随（保持一致）还是统一成 `null`（并登记偏离）。

### 2.5 选项编辑器

与 select 共用 `option-items-setting.vue`，操作：

| 按钮 | 行为 |
|---|---|
| `addOption` | push `{ value: optionItems.length + 1, label: 'new option' }` |
| `importOptions` | 导出为文本（`value,label`，value===label 时只输出 value） |
| `saveOptions` | 解析并整表替换，分隔符 `','`，空行跳过 |
| `resetDefault` | ⚠️ 设为 `''`（见 2.4） |

每行有 value 输入、label 输入、拖拽把手、删除按钮。
⚠️ **`disabled` 没有设计态编辑入口**，只能通过 `disableOption()` API 设置。

---

## 三、运行态行为

### 3.1 模板绑定

```html
<el-radio-group ref="fieldEditor" v-model="fieldModel"
                :disabled="field.options.disabled"
                :size="field.options.size"
                @change="handleChangeEvent">
  <template v-if="!!field.options.buttonStyle">
    <el-radio-button v-for="(item, index) in field.options.optionItems" :key="index"
                     :label="item.value"
                     :disabled="item.disabled"
                     :border="field.options.border"
                     :style="{ display: field.options.displayStyle }">
      {{ item.label }}
    </el-radio-button>
  </template>
  <template v-else>
    <el-radio v-for="(item, index) in field.options.optionItems" :key="index"
              :label="item.value"
              :disabled="item.disabled"
              :border="field.options.border"
              :style="{ display: field.options.displayStyle }">
      {{ item.label }}
    </el-radio>
  </template>
</el-radio-group>
```

### 3.2 ⚠️ `displayStyle` 是**显式**设置 `display`，不是"两档样式"

```html
:style="{ display: field.options.displayStyle }"
```

`displayStyle` 的值直接作为 CSS `display` 的值：

| `displayStyle` | 渲染结果 | 效果 |
|---|---|---|
| `'inline'`（默认） | `display: inline` | **显式把 `el-radio` 从默认的 `inline-block` 改成 `inline`** |
| `'block'` | `display: block` | 每个选项独占一行 |

⚠️ **这一点极易抄错**。常见错误是写成"`block` 时设 `display: block`，否则不设样式"——
那样 `inline` 时元素保持 Element 默认的 `inline-block`，**与参考的 `inline` 不等价**：
`inline-block` 会保留盒模型边距、不参与文本流换行，密集排列时的间距和折行行为都不同。

**正确做法：无条件把 `displayStyle` 的值绑到 `display` 上。**

### 3.3 ⚠️ Element UI 的 `:label` 就是"值"

```html
<el-radio :label="item.value">{{ item.label }}</el-radio>
```

Element UI 的 `el-radio` 语义是：**`label` 既是显示文本也是选中后写入 `v-model` 的值**；
这里用 `<el-radio>` 的默认插槽覆写了显示文本，所以 `label` prop 只承担"值"的角色。

**Element Plus 已经改了**：`el-radio` 的 `:value` 才是值，`:label` 退回为纯显示文本。
**迁移时必须改成 `:value="item.value"`**，否则：
- `v-model` 绑定的值与点击时写入的值不一致
- 表现为"点了没反应"或"选中态错乱"

⚠️ 这一条同时影响 `el-radio-button`（同理）。

### 3.4 事件映射

| DOM 事件 | 处理函数 | 广播 change/formChange | 自定义钩子 |
|---|---|---|---|
| `@change` | `handleChangeEvent(value)` | ✅ | `onChange(value, oldValue)` |

⚠️ **radio 只监听 `@change`**——没有 `focus` / `blur` / `input`。
所以属性面板里也没有 `onFocus` / `onBlur` / `onInput`。

⚠️ `handleChangeEvent` 里 `oldFieldValue` 的处理：
radio **会**触发 `focus`（点击选项时），但参考**没有监听 focus**——
所以 `oldFieldValue` 只能靠 `handleChangeEvent` 末尾的 `deepClone(value)` 刷新
（`fieldMixin.js:321`）。**第一次 change 时 `onChange` 的 `oldValue` 是 `initFieldModel` 时存的初始值**，这是正确的。

### 3.5 数据形态

| 项 | 值 |
|---|---|
| 初始化值 | `null`（未选中） |
| 未选中时 | `null` |
| 选中后 | `optionItems[i].value` 的原类型（示例里是 `number`） |
| 值可以是 | `string` / `number` / `boolean`（跟随选项 value 的类型） |
| `resetField()` 后 | `field.options.defaultValue`（初始为 `null`） |

⚠️ **`null` 与 `''` 都可能出现在数据里**（取决于是否点过"重置默认值"，见 2.4）。

### 3.6 选项类通道

```js
created() {
  this.initOptionItems()     // ⚠️ 选项类
  this.initFieldModel()
  ...
}
```

- 设计态 `initOptionItems()` 直接 return，不加载 `optionData`
- 运行态从 `getOptionData()[字段名]` 取值 → `loadOptions(v)` 覆盖 `optionItems`
- `reloadOptionData(name)` → `reloadOptions(v)`（不清空已选值）

---

## 四、校验语义

沿用通用规范第四章。radio 特有的注意点（**这是 radio 最容易出错的地方**）：

1. **`required` 的 `trigger` 只有 `['blur']`** ——
   ```
   源码注释：去掉change事件触发校验，change事件触发时formModel数据尚未更新，
            导致radio/checkbox必填校验出错！！
   ```
   这正是"点选类组件必须只用 blur 触发必填校验"这条规则的来源。
   **抄成 `['blur','change']` 会在 radio 上稳定复现"选了值仍然报必填"。**

2. 选中一个选项后 `handleChangeEvent` 会 `dispatch('fieldValidation')` → `validateField`，
   如果此时 `formModel` 已同步，必填错误就会清除。**顺序不能反**：
   `syncUpdateFormModel` 必须在 `dispatch('fieldValidation')` **之前**执行
   （`fieldMixin.js:317` 在 `324` 之前）。

3. 空值 `null` / `''` 会被内置校验器直接放过。

4. radio 没有 `@input`，所以不存在"输入过程中触发校验"的场景。

---

## 五、状态语义

| 状态 | 表现 |
|---|---|
| `disabled: true` | 整个 `el-radio-group` 禁用（所有选项不可点） |
| `hidden: true` | 运行态不渲染；设计态渲染并带隐藏图标 |
| `readonly` | **不存在** |
| `clearable` | **不存在**（radio 无法取消选中） |
| `buttonStyle: true` | 用 `el-radio-button`（按钮组样式）替换 `el-radio` |
| `border: true` | 给每个选项加边框 |
| `displayStyle: 'block'` | 每项独占一行 |

⚠️ **`buttonStyle` 是模板级分支**（`v-if` 切换 `el-radio-button` / `el-radio`），
不是同一个组件的属性——两种模式渲染出的 DOM 结构完全不同。

⚠️ **单选组无法取消选中**：点已选中的项不会再触发变更，`v-model` 保持原值。参考没有提供清空手段。

---

## 六、公开 API（继承 `fieldMixin`）

```js
loadOptions(options) / reloadOptions(options) / getOptions()
disableOption(optionValue) / enableOption(optionValue)
clearSelectedOptions()      // radio 走 else 分支 → fieldModel = ''
getValue() / setValue(v) / resetField()
setDisabled(flag) / setHidden(flag) / setRequired(flag) / setLabel(v)
```

⚠️ **`clearSelectedOptions()` 对 radio 会把值设为 `''`，而不是 `null`**：

```js
if (checkbox || (select && multiple)) fieldModel = []
else fieldModel = ''          // ⚠️ radio 走这里
```

且它**只改 `fieldModel`，不写 `formModel`**（`fieldMixin.js:512-523`）。
这是参考实现的缺陷，抄实现时建议记录为有意偏离并修正为"同时同步数据源"。

---

## 七、⚠️ 已知坑

| # | 坑 |
|---|---|
| 1 | **`required` 的 trigger 只有 `['blur']`**——加 change 会误报必填 |
| 2 | **`displayStyle` 是无条件绑到 CSS `display`**，不是"block 时才设样式" |
| 3 | **Element UI 的 `:label` 是值**，EP 已改为 `:value`——迁移必改 |
| 4 | 初始 `defaultValue` 是 `null`，但 `resetDefault` 设成 `''`（两种空值语义） |
| 5 | `clearSelectedOptions()` 设成 `''` 且不写数据源 |
| 6 | 没有 `focus` / `blur` / `input` 事件，只有 `change` |
| 7 | 没有 `readonly` / `clearable` / `placeholder` |
| 8 | `buttonStyle` 切换的是**模板分支**，DOM 结构不同 |
| 9 | `optionItems` 的 `disabled` 无设计态入口 |
| 10 | 选项 `:key` 用的是**数组下标**（`item` 重排时会复用 DOM） |
| 11 | 默认值编辑藏在 `option-items-setting` 里，属性面板不出现 `defaultValue` 输入框 |
| 12 | `emitDefaultValueChange` 依赖组件 `name`，为空则改默认值无反应 |

⚠️ 关于第 10 条：参考用 `:key="index"`，选项重排时 Vue 会按位置复用 DOM。
本仓库若改用 `value` 作 key 是**改进**，但需登记为有意偏离（行为在极端场景下不同）。

---

## 八、Element UI → Element Plus 差异

| # | Element UI 2.x | Element Plus | 处理 |
|---|---|---|---|
| 1 | `el-radio :label` = 值 | **`:value` = 值，`:label` = 显示文本** | **必须改为 `:value`** |
| 2 | `el-radio-button :label` = 值 | 同 1，改为 `:value` | **必须改** |
| 3 | `el-radio :border` | 仍支持 | 保留 |
| 4 | `el-radio-button :border` | ❌ **EP 已移除** | **有意省略**，见下 |

✅ **第 4 条已核实**（element-plus 2.14.4）：

```ts
// es/components/radio/src/radio-button.d.ts
interface RadioButtonProps extends RadioPropsBase {}   // ← 不含 border

// es/components/radio/src/radio.d.ts
interface RadioPropsBase { modelValue, size, disabled, label, value, name }   // ← 无 border
interface RadioProps extends RadioPropsBase { border?: boolean }              // ← border 只在这里
```

运行时 `radioButtonProps` 的键为 `modelValue / size / disabled / label / value / name`——**没有 `border`**。

**结论**：`audit.ts` 的 `WAIVERS` 中"Element Plus 的 el-radio-button 已移除 border 属性"这条**成立**，
本仓库只在 `ElRadio` 上绑 `border` 是**正确实现**，不是抄漏。
（若强行绑到 `ElRadioButton`，只会作为 fallthrough attribute 落到根 DOM 上。）
| 5 | `el-radio-group` `v-model` | 一致 | 无 |
| 6 | `size: 'medium'` | EP 用 `'default'`，不接受 `''` | 归一化 |
| 7 | `el-radio` 的 `display` 默认 `inline-block` | 一致 | 见 3.2，**不要依赖默认值** |
| 8 | 编辑器内部 `el-radio :label` 用于勾选 | 必须改 `:value` | **设计态也要改** |

⚠️ 第 4 条的核实结论见上，**WAIVERS 成立**，无需改动。
（同类问题也存在于 checkbox，见后续文档。）

---

## 九、与本仓库现状的差距

对照 `packages/materials/src/components/Radio.vue`（127 行）：

| # | 差距 | 影响 | 优先级 |
|---|---|---|---|
| 1 | **`ElRadioButton` 上没有绑 `border`** | ✅ **已核实：EP 确实不支持**（`RadioButtonProps` 不含 `border`）。参考绑了但 EP 无法承接，属**上游库差异**，`WAIVERS` 成立，**无需改动** | ✅ 已核实 |
| 2 | **`displayStyle` 实现不等价**：`displayStyle === 'block' ? 'display: block' : undefined` | 参考是**无条件**绑定，`inline` 时显式设 `display: inline`；本仓库在 `inline` 时用 EP 默认的 `inline-block`，**视觉与折行行为有差异** | 高 |
| 3 | **`optionItems` 内置了默认值 `radio 1/2/3`（prop default）** | 参考的初始选项来自**设计器物料配置**，组件本身不设默认。本仓库把设计态初始值塞进运行时组件，导致**运行时未传 `optionItems` 时凭空出现 3 个假选项** | 高 |
| 4 | **没有 `onValidate`** | 自定义校验无入口 | 高 |
| 5 | **没有 `onCreated` / `onMounted` / `onChange`** | 参考的 4 个事件钩子缺 3 个 | 高 |
| 6 | **没有 `validation`（内置校验器）** | 9 个内置校验器无入口 | 高 |
| 7 | **没有 `initOptionItems` / `optionData` 通道** | 无法动态注入选项 | 高 |
| 8 | **`size: 'default'` 而非 `''`** | 参考默认 `''`（跟随全局）。本仓库默认 `'default'`，**会覆盖表单级 size 继承** | 中 |
| 9 | **`modelValue: null` 会被转成 `undefined` 再转回 `null`** | `radioValue` computed 做 `?? undefined`，`update:model-value` 做 `$event ?? null`。基本等价，但 EP 的 `el-radio-group` 在无匹配项时的行为需验证 | 低 |
| 10 | **选项 `:key` 用 `` `${value}-${index}` ``** | 比参考的 `index` 更稳，属**改进**，建议登记为有意偏离 | 信息性 |
| 11 | ~~**`border` prop 的 JSDoc 写着"按钮样式下 Element Plus 不支持，将忽略"**~~ | ✅ **已核实：该说明正确**，并已在组件模板中补上 `radio-button.d.ts` 的证据注释 | ✅ 已核实 |

### 已确认的等价项

- `disabled` / `hidden` / `buttonStyle`（模板分支切换）/ `label*` 系列绑定语义一致
- `optionItems` 的 `label` / `value` / `disabled` 透传一致
- 使用 `:value` 而非 `:label`——**这是正确的 EP 迁移**（参考是 `:label`，属上游差异）

---

## 十、验收标准

### 设计态

- [ ] 拖入后 `optionItems` 默认 3 项 `radio 1/2/3`，`defaultValue` 为 `null`
- [ ] 属性面板**不出现** `defaultValue` 输入框，默认值通过选项列表勾选设置
- [ ] 点"重置默认值"后 `defaultValue` 变为 `''`（复现参考的不一致）
- [ ] `addOption` 新增项为 `{ value: 项数+1, label: 'new option' }`
- [ ] 选项可拖拽排序
- [ ] 切换 `buttonStyle` 后画布在 `el-radio-button` / `el-radio` 之间切换
- [ ] 切换 `displayStyle` 后画布选项的 `display` 随之变为 `inline` / `block`
- [ ] 组件 `name` 为空时改默认值，画布不变更（复现参考）

### 运行态

- [ ] 初始未选中（`null`），页面上没有任何选项被选中
- [ ] 点击选项后 `formModel` 更新为该项的 `value`，`formChange` 触发一次
- [ ] `onChange(value, oldValue)` 第一次触发时 `oldValue` 为初始值
- [ ] 点击**已选中**的选项不触发 change
- [ ] `displayStyle: 'inline'` 时选项的 `display` 计算值为 `inline`（**不是 `inline-block`**）
- [ ] `displayStyle: 'block'` 时每个选项独占一行
- [ ] `buttonStyle` 为真时渲染按钮组；为假时渲染普通单选
- [ ] `border` 为真时**普通单选**带边框
- [ ] `border` 为真且 `buttonStyle` 为真时，**按钮样式不带边框**（EP 不支持，属上游差异；且不应在 DOM 上出现 `border` 属性）
- [ ] `disabled` 为真时所有选项不可点

### 选项类通道

- [ ] 设计态不加载 `optionData`
- [ ] 运行态 `optionData` 含该字段名时替换 `optionItems`
- [ ] `reloadOptionData(name)` 后已选值保持不变
- [ ] `disableOption(v)` 后该项不可点，`enableOption(v)` 恢复

### 校验

- [ ] `required` 为真时 blur 报错
- [ ] **选中一个值后必填错误立即消失**（验证 `syncUpdateFormModel` 在 `fieldValidation` 之前）
- [ ] **选值过程中不提前报必填错误**（验证 trigger 里没有 change）
- [ ] 空值（`null`）被内置校验器放过

### API

- [ ] `setValue(v)` 选中对应选项并同步 `formModel`
- [ ] `resetField()` 恢复为 `defaultValue`（`null`）
- [ ] `getValue()` 返回当前选中值
- [ ] `clearSelectedOptions()` 把值设为 `''`（复现参考行为）

---

## 附：参考实现关键行号

| 关注点 | 位置 |
|---|---|
| 模板（buttonStyle 分支 + displayStyle 绑定） | `radio-widget.vue:5-18` |
| `created` 调用顺序（**有** initOptionItems） | `radio-widget.vue:76-86` |
| 选项编辑器的 radio 分支 | `option-items-setting.vue:3-17` |
| `resetDefault` 设为 `''` | `option-items-setting.vue:180-189` |
| 默认值隐藏编辑器 | `property-editor/field-radio/radio-defaultValue-editor.vue` |
| `buildFieldRules` 的 trigger 注释 | `fieldMixin.js:197-204` |
| `handleChangeEvent` 顺序 | `fieldMixin.js:316-325` |
| `clearSelectedOptions` | `fieldMixin.js:512-523` |
| 物料初始 options | `widgetsConfig.js:232-281` |
