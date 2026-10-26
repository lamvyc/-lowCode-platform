# grid · 栅格

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `grid` |
| 名称 | 栅格 |
| 分组 | 容器 |
| 可放置容器 | 否 |
| 说明 | 24 栅格布局容器，可增删列并逐列设置宽度 |

## 二、默认属性

```json
{
  "gutter": 12,
  "colHeight": null,
  "justify": "start"
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `columns` | 栅格列 | `structure` | `None` |  |
| `gutter` | 栅格间隔(px) | `number` | `12` |  |
| `colHeight` | 栅格列统一高度(px) | `number` | `None` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `justify` | 水平排列 | `select` | `start` |  选项：起始/居中/末尾/两端对齐/环绕 |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-row` 栅格行 | 默认 | ✅ |
| 2 | `has-cols` | 默认带出至少 1 个 `.el-col` 栅格列 | 默认 | ✅ |
| 3 | `prop-gutter` | `gutter` 设为 20 后，栅格列出现水平内边距 | `{"gutter": 20}` | ✅ |
| 4 | `prop-colheight` | `colHeight` 设为 120 后，每一列的高度都是 120px（参考实现的逐列高度语义） | `{"colHeight": 120}` | ✅ |

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
