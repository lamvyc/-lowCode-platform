# button · 按钮

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `button` |
| 名称 | 按钮 |
| 分组 | 基础字段 |
| 可放置容器 | 否 |
| 说明 | 触发事件与动作链 |

## 二、默认属性

```json
{
  "label": "按钮",
  "type": "",
  "size": "default",
  "plain": false,
  "round": false,
  "circle": false,
  "disabled": false,
  "displayStyle": "inline",
  "columnWidth": ""
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `label` | 按钮文案 | `input` | `按钮` |  |
| `type` | 按钮类型 | `select` | `` |  选项：默认/主要/成功/警告/危险/信息 |
| `displayStyle` | 显示样式 | `radio-button` | `inline` |  选项：行内/块级 |
| `size` | 组件大小 | `radio-button` | `default` |  选项：默认/大/小 |
| `disabled` | 禁用 | `switch` | `False` |  |
| `columnWidth` | 宽度 | `input` | `` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `plain` | 朴素按钮 | `switch` | `False` |  |
| `round` | 圆角按钮 | `switch` | `False` |  |
| `circle` | 圆形按钮 | `switch` | `False` | （仅当 `round` = `False` 时可见） |
| `icon` | 按钮图标 | `input` | `` |  |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-button` | 默认 | ✅ |
| 2 | `default-type` | 默认类型是 Element 的"默认"样式（白底灰边），不是蓝色实心 primary | 默认 | ✅ |
| 3 | `prop-label` | `label` 设置后，按钮文案随之变化 | `{"label": "提交X"}` | ✅ |
| 4 | `common-label` | `label` 设置后，该物料的文本里出现这个值 | `{"label": "标签X"}` | ✅ |

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
