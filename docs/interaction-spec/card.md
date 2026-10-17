# card · 卡片

> **本文件由 `scripts/gen-interaction-spec.py` 生成，不要手改。**
> 唯一来源是 `scripts/spec-assertions.mjs` 里的断言表；
> 同一张表也被 `scripts/browser-checks.mjs` 的 `spec-conformance` 检查执行。

## 一、组件身份

| 项 | 值 |
| --- | --- |
| 类型 | `card` |
| 名称 | 卡片 |
| 分组 | 容器 |
| 可放置容器 | 是 |
| 说明 | 带标题与折叠能力的容器 |

## 二、默认属性

```json
{
  "label": "card",
  "collapsed": false,
  "showCollapse": true,
  "hideTitle": false,
  "width": "100%",
  "shadow": "never"
}
```

## 三、属性面

### 通用设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `name` | 唯一名称 | `name` | `None` |  |
| `label` | 标签 | `label` | `` |  |
| `hidden` | 隐藏 | `hidden` | `None` |  |
| `hideTitle` | 隐藏标题区 | `switch` | `False` |  |

### 高级设置

| prop | 面板标签 | 控件 | 默认值 | 备注 |
| --- | --- | --- | --- | --- |
| `style` | 自定义CSS样式 | `style` | `None` |  |
| `class` | 自定义类名 | `custom-class` | `None` |  |
| `showCollapse` | 显示折叠按钮 | `switch` | `True` |  |
| `collapsed` | 默认收起 | `switch` | `False` | （仅当 `showCollapse` = `True` 时可见） |
| `width` | 卡片宽度 | `input` | `100%` |  |
| `shadow` | 阴影 | `radio-button` | `never` |  选项：总是/悬停/从不 |

## 四、验收标准

> 每一条都对应 `scripts/spec-assertions.mjs` 里的一条**真机断言**，
> 由 `pnpm verify:browser -- --only spec-conformance` 执行。
> 断言 id 写在方括号里，改动时两边必须同步（表是唯一来源，文档是生成的）。

| # | 断言 id | 验收标准 | 前置属性 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | `render` | 渲染为 `.el-card` | 默认 | ✅ |
| 2 | `header-and-body` | 带 header 槽与 body 两个区域 | 默认 | ✅ |
| 3 | `default-title` | 默认标题为 `card`（对齐参考的默认 label） | 默认 | ✅ |

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
