# alert · 提示

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `alert` |
| 名称 | 提示 |
| 分组 | 自定义扩展字段 |
| 可放置容器 | 否 |
| 说明 | 可关闭的提示条 |

## 二、默认属性

```json
{
  "title": "Good things are coming...",
  "type": "info",
  "description": "",
  "closable": true,
  "closeText": "",
  "center": true,
  "showIcon": false,
  "effect": "light"
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `title` | 标题 | `input` | `Good things are coming...` |  |
| `type` | 主题 | `select` | `info` |  选项：成功/警告/信息/错误 |
| `description` | 辅助描述 | `textarea` | `` |  |
| `closable` | 可关闭 | `switch` | `True` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `closeText` | 关闭时文字描述 | `input` | `` |  |
| `center` | 文字居中 | `switch` | `True` |  |
| `showIcon` | 显示图标 | `switch` | `False` |  |
| `effect` | 主题样式 | `select` | `light` |  选项：浅色/深色 |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-alert` | 默认 | ✅ |
| 2 | `closable-default` | 默认 `closable: true` 时显示关闭按钮（参考的 `alertSchema` 默认也是 true） | 默认 | ✅ |
| 3 | `prop-closable` | `closable` 关掉后，关闭按钮消失 | `{"closable": false}` | ✅ |

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
