# input · 单行文本输入

> 参考源码：`variant-form/src/components/form-designer/form-widget/field-widget/input-widget.vue`（112 行）
> 物料声明：`widget-panel/widgetsConfig.js:102-150`（`basicFields` 第 1 项）
> **前置阅读**：[00 · 通用字段行为规范](./00-通用字段行为规范.md)

---

## 一、组件身份

| 项 | 值 |
|---|---|
| `type` | `input` |
| 中文名（i18n key） | `designer.widgetLabel.input` |
| 图标 | `text-field` |
| 分组 | `basicFields`（基础字段） |
| `formItemFlag` | `true` |
| `internal` | `false` |
| `category` | 字段（非容器） |
| 特有 ref | `fieldEditor` → `el-input` |

---

## 二、设计态行为

### 2.1 拖入面板后的初始 schema

```json
{
  "type": "input",
  "icon": "text-field",
  "formItemFlag": true,
  "options": {
    "name": "", "label": "", "labelAlign": "",
    "type": "text",
    "defaultValue": "",
    "placeholder": "",
    "columnWidth": "200px",
    "size": "",
    "labelWidth": null, "labelHidden": false,
    "readonly": false, "disabled": false, "hidden": false,
    "clearable": true, "showPassword": false,
    "required": false, "requiredHint": "",
    "validation": "", "validationHint": "",
    "customClass": "",
    "labelIconClass": null, "labelIconPosition": "rear", "labelTooltip": null,
    "minLength": null, "maxLength": null, "showWordLimit": false,
    "prefixIcon": "", "suffixIcon": "",
    "appendButton": false, "appendButtonDisabled": false, "buttonIcon": "el-icon-search",
    "onCreated": "", "onMounted": "", "onInput": "", "onChange": "",
    "onFocus": "", "onBlur": "", "onValidate": "", "onAppendButtonClick": ""
  }
}
```

⚠️ `columnWidth` 默认 `'200px'`——**这是字段默认宽度**，不是"自适应"。
⚠️ `labelIconPosition` 默认 `'rear'`。
⚠️ `buttonIcon` 默认 `'el-icon-search'`（Element UI 图标类名字符串）。

### 2.2 属性面板

分三组，由 `propertyRegister.js` 的 `COMMON_PROPERTIES` / `ADVANCED_PROPERTIES` / `EVENT_PROPERTIES` 驱动。

| 组 | option | 编辑器 | 控件 | 备注 |
|---|---|---|---|---|
| 基础 | `name` | `name-editor` | — | 重名会互相覆盖（见通用规范 5.2） |
| 基础 | `label` | `label-editor` | — | |
| 基础 | `labelAlign` | `labelAlign-editor` | — | 空=继承表单 |
| 基础 | `type` | `type-editor` | select | **text / password / number**（见 2.3） |
| 基础 | `defaultValue` | `defaultValue-editor` | text | ⚠️ 组件**没有** `optionItems`，所以这个编辑器会渲染（`defaultValue-editor.vue` 的 `v-if="!hasConfig('optionItems')"`） |
| 基础 | `placeholder` | `placeholder-editor` | text | |
| 基础 | `columnWidth` | `columnWidth-editor` | — | |
| 基础 | `size` | `size-editor` | — | |
| 基础 | `labelWidth` | `labelWidth-editor` | number | |
| 基础 | `labelHidden` | `labelHidden-editor` | switch | |
| 基础 | `required` | `required-editor` | switch | |
| 基础 | `requiredHint` | `requiredHint-editor` | text | |
| 基础 | `validation` | `validation-editor` | **select + allow-create** | 可选项：内置校验器名；也可手输正则 |
| 基础 | `validationHint` | `validationHint-editor` | text | |
| 基础 | `readonly` | `readonly-editor` | switch | |
| 基础 | `disabled` | `disabled-editor` | switch | |
| 基础 | `hidden` | `hidden-editor` | switch | |
| 基础 | `clearable` | `clearable-editor` | switch | |
| 基础 | `showPassword` | `showPassword-editor` | switch | |
| 基础 | `customClass` | `customClass-editor` | — | ⚠️ 值是**数组** |
| 高级 | `minLength` | `minLength-editor` | | |
| 高级 | `maxLength` | `maxLength-editor` | | |
| 高级 | `showWordLimit` | `showWordLimit-editor` | switch | |
| 高级 | `prefixIcon` | `prefixIcon-editor` | | |
| 高级 | `suffixIcon` | `suffixIcon-editor` | | |
| 高级 | `labelIconClass` | `labelIconClass-editor` | | |
| 高级 | `labelIconPosition` | `labelIconPosition-editor` | | front / rear |
| 高级 | `labelTooltip` | `labelTooltip-editor` | | |
| 高级 | `appendButton` | `appendButton-editor` | switch | |
| 高级 | `appendButtonDisabled` | `appendButtonDisabled-editor` | switch | |
| 高级 | `buttonIcon` | `buttonIcon-editor` | | |
| 事件 | `onCreated` / `onMounted` / `onInput` / `onChange` / `onFocus` / `onBlur` / `onValidate` / `onAppendButtonClick` | `*-editor` | 代码编辑器 | 均为字符串代码 |

### 2.3 ⚠️ `type: 'number'` 是被**故意屏蔽**的

```js
computed: {
  inputType() {
    if (this.field.options.type === 'number') {
      return 'text'   // ⚠️ 源码注释见下
    }
    return this.field.options.type
  }
}
```

> **源码注释原文**（`input-widget.vue:73`）：
> `当input的type设置为number时，如果输入非数字字符，则v-model拿到的值为空字符串，无法实现输入校验！故屏蔽之！！`

**即：属性面板里可以选 `number`，但渲染出来的仍然是 `type="text"`。**
目的是让非数字输入能进入 `v-model`，从而让 `validation: 'number'` 的正则校验能给出提示——
如果用原生 `type="number"`，非法输入直接变空串，用户看不到任何错误。

⚠️ 这条"考古知识"必须照搬。**不要**"修正"成真的 `type="number"`。

### 2.4 设计态的可观察差异

- 画布上组件的类型名显示为 `i18n('designer.widgetLabel.input')`
- 因为组件没有 `optionItems`，属性面板会出现 `defaultValue` 输入框；
  改变它时 `option-items-setting` 那一套不参与，但 `refreshDefaultValue()` 仍会刷新画布

---

## 三、运行态行为

### 3.1 模板绑定（逐项）

```html
<el-input ref="fieldEditor" v-model="fieldModel"
          :disabled="field.options.disabled"
          :readonly="field.options.readonly"
          :size="field.options.size"
          class="hide-spin-button"
          :type="inputType"                         <!-- 见 2.3 -->
          :show-password="field.options.showPassword"
          :placeholder="field.options.placeholder"
          :clearable="field.options.clearable"
          :minlength="field.options.minLength"
          :maxlength="field.options.maxLength"
          :show-word-limit="field.options.showWordLimit"
          :prefix-icon="field.options.prefixIcon"
          :suffix-icon="field.options.suffixIcon"
          @focus="handleFocusCustomEvent"
          @blur="handleBlurCustomEvent"
          @input="handleInputCustomEvent"
          @change="handleChangeEvent">
  <el-button slot="append"
             v-if="field.options.appendButton"
             :disabled="field.options.disabled || field.options.appendButtonDisabled"
             :class="field.options.buttonIcon"
             @click.native="emitAppendButtonClick"></el-button>
</el-input>
```

⚠️ **`placeholder` 直接透传，默认是空字符串 `''`**。
空串时 Element 显示自己的默认占位行为（实际上等于无占位）。**没有**任何兜底文案——
这一点和 select 不同（select 有 i18n 兜底）。

⚠️ `class="hide-spin-button"` 是给 number 型输入框去掉上下微调箭头的，
配套 CSS 在 `form-item-wrapper.vue:286-295`（同时处理 Chrome 和 Firefox）。

⚠️ **`append` 按钮用 `:class` 传图标，不是 `:icon`**。Element UI 的按钮图标是 class；
Element Plus 已改为组件。**这是已登记的偏离**，但同时要注意：
`:disabled="disabled || appendButtonDisabled"` 这个或运算必须保留。

### 3.2 事件映射（严格按通用规范第三章）

| DOM 事件 | 处理函数 | 写 formModel | 广播 change/formChange | 自定义钩子 |
|---|---|---|---|---|
| `@input` | `handleInputCustomEvent(value)` | ✅ | ❌ **不广播** | `onInput(value)`，`this` 绑定组件 |
| `@change` | `handleChangeEvent(value)` | ✅ | ✅ | `onChange(value, oldValue)` |
| `@focus` | `handleFocusCustomEvent(event)` | ❌ | ❌ | `onFocus(event)` |
| `@blur` | `handleBlurCustomEvent(event)` | ❌ | ❌ | `onBlur(event)` |
| append 按钮点击 | `emitAppendButtonClick()` | ❌ | ❌ | `onAppendButtonClick()`；无则 `dispatch('VFormRender','appendButtonClick',[this])` |

⚠️ `emitAppendButtonClick` **设计态直接 return**（`fieldMixin.js:356`）。

⚠️ input 是**唯一**同时注册了 `@input` 和 `@change` 的组件之一。
其他组件（radio/select）只有 `@change`。见各组件文档。

⚠️ 参考注释（`fieldMixin.js:316`）：**清空小按钮会同时触发 change 和 input**。
即点一次"×"，`handleChangeEvent` 和 `handleInputCustomEvent` 都会跑。
`handleChangeEvent` 会广播一次 change，`handleInputCustomEvent` 只同步数据 + 清校验错误。

### 3.3 数据形态

| 项 | 值 |
|---|---|
| `defaultValue` 默认 | `''`（空字符串） |
| 运行时值的类型 | `string` |
| 清空后 | `''` |
| 子表单内 onChange 签名 | `onChange(value, oldValue, subFormData, rowId)` |

### 3.4 没有的能力（不要凭空补）

- ❌ 没有 `initOptionItems()`——input 不是选项类组件
- ❌ 没有 `loadOptions` / `reloadOptions` / `disableOption` 的实际使用场景
- ❌ 没有 `onClear`（清空走的是 change + input，不是独立事件）

---

## 四、校验语义

沿用通用规范第四章。input 特有的注意点：

1. `required` 规则 `trigger: ['blur']`——**输入框只支持 blur 触发必填校验**。
2. `validation` 的内容校验 `trigger: ['blur','change']`——输入时实时校验。
3. **空值直接通过**：内置校验器遇到 `''` 会 `callback()`，所以
   "非必填 + 邮箱格式"在空输入时**不会报错**。
4. `validation: 'number'` 依赖 2.3 的"屏蔽 number 类型"设计：
   非法输入留在输入框里 → blur 时正则校验给出提示。
5. `minLength` / `maxLength` 是**原生 input 属性透传**，控制的是"能否继续输入"，
   不是校验规则——**超长时不会出现校验错误提示**。
6. `showWordLimit` 依赖 `maxlength`；没有 `maxlength` 时字数统计无意义。

---

## 五、状态语义

| 状态 | 表现 |
|---|---|
| `disabled: true` | el-input 禁用；append 按钮也禁用 |
| `readonly: true` | 只读（可聚焦、可复制、不可改） |
| `hidden: true` | 运行态**整个 `el-form-item` 不渲染**；设计态仍渲染并带隐藏图标 |
| `appendButtonDisabled: true` | 仅 append 按钮禁用，输入框正常 |

⚠️ `disabled` 和 `appendButtonDisabled` 是**或**关系：`disabled` 为真时 append 一定禁用。

---

## 六、公开 API（继承 `fieldMixin`，见通用规范第八章）

input 上最常用的：

```js
setValue(v) / getValue() / resetField() / focus()
setDisabled(flag) / setReadonly(flag) / setHidden(flag) / setRequired(flag) / setLabel(v)
setWidgetOption(name, value)
addCssClass(cls) / removeCssClass(cls)
getFieldEditor()      // → el-input 实例（ref="fieldEditor"）
```

⚠️ `resetField()` 对 input 的语义是 `setValue(field.options.defaultValue)`，
默认 `''`。**不是清空为 `null`。**

---

## 七、⚠️ 已知坑

| # | 坑 |
|---|---|
| 1 | `type: 'number'` 会被强制转成 `'text'`——这是**有意设计**，不要"修好" |
| 2 | `placeholder` 无兜底文案，默认空串 |
| 3 | `@input` 不广播 change；`@change` 才广播 |
| 4 | 清空按钮会**同时**触发 input 和 change 两个处理函数 |
| 5 | append 按钮的图标在 Element UI 里用 `:class`，不是 `:icon` |
| 6 | `customClass` 是数组，不是字符串 |
| 7 | `minLength`/`maxLength` 是原生属性，不产生校验错误 |
| 8 | `hidden` 在设计态和运行态表现相反 |

---

## 八、Element UI → Element Plus 差异

| # | 参考（Element UI 2.x） | Element Plus | 处理建议 |
|---|---|---|---|
| 1 | `el-button :class="iconClass"` 传图标 | 用 `:icon` 组件或 `#icon` 插槽 | 已登记偏离；保持 `:icon`，但需确认 `el-icon-search` 类名到 EP 组件的映射 |
| 2 | `@click.native` | Vue 3 无 `.native` 修饰符，直接 `@click` | 直接改 |
| 3 | `size: 'medium'` | EP 用 `'default'`，且**不接受空字符串** | 需要 `'' → undefined` 的归一化 |
| 4 | `el-input` 的 `minlength` | EP 同样非声明式 prop，靠透传到原生 input | 行为一致，但 TS 类型会报错，需 `v-bind` 或忽略 |
| 5 | `show-password` 在非 password 类型下 | EP 同样只在 password 下显示切换按钮 | 等价 |
| 6 | `slot="append"` | Vue 3 用 `#append` | 直接改 |
| 7 | 事件参数：`@input` 回调直接是 value | EP 的 `input` 事件参数是 `(value: string)`，一致 | 等价 |

---

## 九、与本仓库现状的差距

对照 `packages/materials/src/components/Input.vue`（140 行）——**该文件未做行为审计，以下仅列已确认的差异**：

| # | 差距 | 影响 | 优先级 |
|---|---|---|---|
| 1 | **`type` 只允许 `'text' \| 'password' \| 'textarea'`，不含 `'number'`** | 参考的 `type: 'number'` 选项无法表达；`validation: 'number'` 的配套设计（2.3）整体缺失 | 高 |
| 2 | **把 `textarea` 合并进了 input**（用 `rows` prop） | 参考里 textarea 是**独立组件**（独立 type、图标、物料项）。合并会导致 schema 中 `type` 语义与参考不一致，代码生成/导入导出都会错位 | 高 |
| 3 | **`placeholder` 默认 `'请输入'`**，参考默认 `''` | 用户不填 placeholder 时，参考显示空、本仓库显示"请输入"——**直接的视觉差异** | 高 |
| 4 | **完全没有 `validation`（内置校验器）能力** | 参考的 9 个内置校验器 + 自定义正则在本组件无入口 | 高 |
| 5 | **完全没有 `onValidate`** | 自定义校验无法配置 | 高 |
| 6 | **没有 `onCreated` / `onMounted` / `onInput` / `onChange` / `onFocus` / `onBlur` / `onAppendButtonClick`** | 参考的 8 个事件钩子全部缺失（这是"事件模型差异"豁免覆盖的部分，需确认是否有意） | 高 |
| 7 | **`@input` 与 `@update:model-value` 同时绑定** | Element Plus 的 `ElInput` 在同一次输入中会**同时**触发这两个事件，可能造成外部处理两次。参考只有一个 `@input` | 中 |
| 8 | **`showWordLimit && Boolean(maxLength)`** | 参考直接透传 `showWordLimit`。本仓库在未设 maxlength 时强制关闭字数统计，是行为收紧 | 低 |
| 9 | **`show-password="showPassword && type === 'password'"`** | 参考直接透传。EP 内部本就只在 password 下生效，属冗余但等价 | 低（信息性） |
| 10 | **`type: 'textarea'` 时把 `rows` 绑给 `el-input`** | EP 的 `ElInput` 需要 `type="textarea"` 才认 `rows`；参考无此路径 | 信息性 |
| 11 | **`appendButton` 用 `:icon="buttonIcon"`** | 已登记为偏离；但需确认 `'el-icon-search'` 这类 **Element UI 类名**在 EP 下能否解析为图标组件。**建议在 props 里做类名→组件的映射，或改存组件名** | 中 |

### 已确认的等价项（无需改动）

- `clearable` / `disabled` / `readonly` / `showPassword` / `prefixIcon` / `suffixIcon` 的绑定语义一致
- `labelWidth` / `labelHidden` / `labelAlign` / `labelIconClass` / `labelIconPosition` / `labelTooltip` / `required` / `requiredHint` / `columnWidth` 透传给 `FormItem` 的路径合理（**但 `FormItem.vue` 内部实现未审计**，需单独核对标签宽度与必填星号的规则）
- append 按钮的 `disabled || appendButtonDisabled` 或运算一致

---

## 十、验收标准

### 设计态

- [ ] 从物料面板拖入后，schema 的 `options` 与 2.1 一致
- [ ] 属性面板出现 `defaultValue` 输入框（因为无 `optionItems`）
- [ ] 修改 `defaultValue` 后画布立即更新
- [ ] `type` 选项含 `number` 时，画布渲染的仍是 `type="text"`（2.3）
- [ ] `labelIconPosition` 默认 `'rear'`
- [ ] `labelHidden` 打开时设计态标签宽度为 5px

### 运行态

- [ ] 未填 `placeholder` 时**不显示**"请输入"之类的兜底文案
- [ ] 输入文字：`formModel` 更新；`formChange` **不触发**
- [ ] 失焦：`formModel` 更新；`formChange` **触发**；`onChange(value, oldValue)` 触发
- [ ] 点击清空按钮：`formModel` 变为 `''`，且 change 只广播一次
- [ ] `appendButton` 为真时显示 append 按钮；`disabled` 或 `appendButtonDisabled` 为真时按钮禁用
- [ ] 点击 append 按钮触发 `onAppendButtonClick`；无该配置时向外派发 `appendButtonClick`
- [ ] 设计态下点击 append 按钮**不触发**任何自定义代码

### 校验

- [ ] `required` 为真时 blur 报错，**输入过程中不报错**
- [ ] `validation: 'email'` 时，空值**通过**，非法值 blur 时提示 `validationHint` 或默认文案
- [ ] `validation: 'number'` 时，输入 `abc` 能保留在输入框内并给出校验提示（依赖 2.3）
- [ ] `validation` 填一个正则字符串时按正则校验
- [ ] `onValidate` 能拿到 `rule` / `value` / `callback`
- [ ] 自定义 `requiredHint` 为空时显示 i18n 的 `render.hint.fieldRequired`

### API

- [ ] `setValue('abc')` 后输入框显示 `abc`，`formModel` 同步，且广播一次 change
- [ ] `resetField()` 恢复为 `defaultValue`（空串，不是 null）
- [ ] `focus()` 让输入框获得焦点
- [ ] `setDisabled(true)` 后输入框禁用
- [ ] `setReadonly(true)` 后输入框只读但仍可聚焦

### 状态

- [ ] `hidden: true` 时运行态不渲染、设计态渲染并带隐藏图标
- [ ] `hidden` 从 true 改回 false 时校验规则被重建

---

## 附：参考实现关键行号

| 关注点 | 位置 |
|---|---|
| 模板全部绑定 | `input-widget.vue:5-19` |
| `inputType` 屏蔽 number | `input-widget.vue:71-78` |
| `created` 调用顺序（无法 initOptionItems） | `input-widget.vue:84-93` |
| append 按钮 | `input-widget.vue:17-18` |
| 隐藏 number 微调箭头 CSS | `form-item-wrapper.vue:286-295` |
| 物料初始 options | `widgetsConfig.js:102-150` |
