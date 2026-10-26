# file-upload · 文件

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `file-upload` |
| 名称 | 文件 |
| 分组 | 高级字段 |
| 可放置容器 | 否 |
| 说明 | 附件上传 |

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
  "modelValue": [],
  "disabled": false,
  "uploadURL": "",
  "uploadTip": "",
  "withCredentials": false,
  "multipleSelect": false,
  "showFileList": true,
  "limit": 3,
  "fileMaxSize": 5,
  "fileTypes": [
    "doc",
    "docx",
    "xls",
    "xlsx"
  ]
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `label` | 标签 | `label` | `` |  |
| `required` | 必填字段 | `switch` | `False` |  |
| `requiredHint` | 必填校验提示 | `input` | `` | （仅当 `required` = `True` 时可见） |
| `uploadURL` | 上传地址 | `input` | `` |  |
| `uploadTip` | 上传提示 | `input` | `` |  |
| `limit` | 最大数量 | `number` | `3` |  |
| `fileMaxSize` | 单文件大小(MB) | `number` | `5` |  |
| `fileTypes` | 允许类型 | `checkbox` | `['doc', 'docx', 'xls', 'xlsx']` |  选项：doc/docx/xls/xlsx/pdf/zip/txt |
| `multipleSelect` | 允许多选 | `switch` | `False` |  |
| `withCredentials` | 携带 Cookie | `switch` | `False` |  |
| `disabled` | 禁用 | `switch` | `False` |  |
| `validation` | 字段校验 | `select` | `` |  选项：无/数字/字母/字母+数字/手机号/邮箱/URL/不含中文 |
| `validationHint` | 校验失败提示 | `input` | `` | （仅当 `validation` ≠ `` 时可见） |
| `labelWidth` | 标签宽度 | `number` | `None` |  |
| `labelHidden` | 隐藏字段标签 | `switch` | `False` |  |
| `labelAlign` | 标签对齐 | `radio-button` | `left` |  选项：左/中/右 |
| `columnWidth` | 组件列宽 | `input` | `` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `showFileList` | 显示文件列表 | `switch` | `True` |  |
| `labelIconClass` | 标签Icon样式 | `input` | `` |  |
| `labelIconPosition` | 图标位置 | `radio-button` | `rear` | （仅当 `labelIconClass` ≠ `` 时可见） 选项：前置/后置 |
| `labelTooltip` | 标签文字提示 | `input` | `` |  |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为文件上传 `.el-upload` | 默认 | ✅ |
| 2 | `plus-icon` | 触发器是 `el-icon-plus` + 「选择文件」文案 | 默认 | ✅ |
| 3 | `no-always-on-tip` | 未设 `uploadTip` 时**不显示**"支持 xx 格式"这类常显提示 | 默认 | ✅ |
| 4 | `common-label` | `label` 设置后，该物料的文本里出现这个值 | `{"label": "标签X"}` | ✅ |
| 5 | `common-required` | `required` 打开后，标签旁出现必填星号 | `{"required": true}` | ✅ |
| 6 | `common-label-hidden` | `labelHidden` 打开后，标签元素消失 | `{"labelHidden": true}` | ✅ |
| 7 | `common-label-width` | `labelWidth` 设为 140 后，标签宽度约为 140px | `{"labelWidth": 140}` | ✅ |

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
