# textarea · 多行输入

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `textarea` |
| 名称 | 多行输入 |
| 分组 | 基础字段 |
| 可放置容器 | 否 |
| 说明 | 多行文本输入 |

## 二、默认属性

```json
{
  "label": "",
  "labelWidth": null,
  "labelHidden": false,
  "labelAlign": "left",
  "labelIconClass": "",
  "labelIconPosition": "rear",
  "labelTooltip": "",
  "required": false,
  "requiredHint": "",
  "validation": "",
  "validationHint": "",
  "columnWidth": "",
  "modelValue": "",
  "placeholder": "请输入",
  "rows": 3,
  "size": "",
  "disabled": false,
  "readonly": false,
  "minLength": null,
  "maxLength": null,
  "showWordLimit": false
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `label` | 标签 | `label` | `` |  |
| `required` | 必填字段 | `switch` | `False` |  |
| `requiredHint` | 必填校验提示 | `input` | `` | （仅当 `required` = `True` 时可见） |
| `modelValue` | 默认值 | `textarea` | `` |  |
| `placeholder` | 占位内容 | `input` | `请输入` |  |
| `rows` | 行数 | `number` | `3` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `minLength` | 最小长度 | `number` | `None` |  |
| `maxLength` | 最大长度 | `number` | `None` |  |
| `showWordLimit` | 显示字数统计 | `switch` | `False` | （仅当 `maxLength` ≠ `None` 时可见） |
| `readonly` | 只读 | `switch` | `False` |  |
| `disabled` | 禁用 | `switch` | `False` |  |
| `validation` | 字段校验 | `select` | `` |  选项：无/数字/字母/字母+数字/手机号/邮箱/URL/不含中文 |
| `validationHint` | 校验失败提示 | `input` | `` | （仅当 `validation` ≠ `` 时可见） |
| `size` | 组件大小 | `select` | `` |  选项：默认/大/小 |
| `labelWidth` | 标签宽度 | `number` | `None` |  |
| `labelHidden` | 隐藏字段标签 | `switch` | `False` |  |
| `labelAlign` | 标签对齐 | `radio-button` | `left` |  选项：左/中/右 |
| `labelIconClass` | 标签Icon样式 | `input` | `` |  |
| `labelIconPosition` | 图标位置 | `radio-button` | `rear` | （仅当 `labelIconClass` ≠ `` 时可见） 选项：前置/后置 |
| `labelTooltip` | 标签文字提示 | `input` | `` |  |
| `columnWidth` | 组件列宽 | `input` | `` |  |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-textarea` | 默认 | ✅ |
| 2 | `prop-rows` | `rows` 设为 5 后，内层 textarea 的 `rows` 属性为 5 | `{"rows": 5}` | ✅ |
| 3 | `prop-maxLength` | `maxLength` 设置后，内层 textarea 的 `maxlength` 属性同步 | `{"maxLength": 12}` | ✅ |

## 五、怎么跑

```bash
# 需要 dev server（默认 5174）
pnpm verify:browser -- --url http://localhost:5174/ --only spec-conformance
```

## 六、这张表的边界

- 只覆盖**默认渲染 + 可断言的单属性效果**。
- 交互后才出现的效果（悬停才出现的清除图标、聚焦才出现的浮层、拖拽中间状态）
  **不在本表**，由 `scripts/browser-checks.mjs` 里各自的专项检查覆盖。
- 事件绑定、动作链、数据源的运行时行为不在本表。
