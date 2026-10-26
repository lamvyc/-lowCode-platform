# html-text · HTML

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `html-text` |
| 名称 | HTML |
| 分组 | 基础字段 |
| 可放置容器 | 否 |
| 说明 | 渲染 HTML 片段 |

## 二、默认属性

```json
{
  "htmlContent": "<b>html text</b>",
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
| `htmlContent` | HTML 内容 | `code` | `<b>html text</b>` |  |
| `columnWidth` | 宽度 | `input` | `` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `renders` | 渲染为 `.lc-html-text` 且内容被当作 HTML 解析 | 默认 | ✅ |

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
