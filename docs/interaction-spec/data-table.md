# data-table · 数据表格

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `data-table` |
| 名称 | 数据表格 |
| 分组 | 自定义扩展字段 |
| 可放置容器 | 否 |
| 说明 | 数据源驱动的表格 |

## 二、默认属性

```json
{
  "data": {
    "type": "expression",
    "value": "$datasource.userList.data"
  },
  "columns": [
    {
      "prop": "name",
      "label": "姓名",
      "width": 120
    },
    {
      "prop": "age",
      "label": "年龄",
      "width": 80
    }
  ],
  "stripe": true,
  "border": true
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `data` | 数据 | `expression` | `$datasource.userList.data` |  |
| `border` | 边框 | `switch` | `True` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `columns` | 列配置 | `json` | `[{'prop': 'name', 'label': '姓名', 'width': 120}, {'prop': 'age', 'label': '年龄', 'width': 80}]` |  |
| `stripe` | 斑马纹 | `switch` | `True` |  |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-table` | 默认 | ✅ |
| 2 | `has-columns` | 渲染出至少一列表头 | 默认 | ✅ |

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
