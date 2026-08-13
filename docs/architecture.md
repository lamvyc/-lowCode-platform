# 架构总览

## 一、包结构

```text
packages/
├── schema/     @lowcode/schema   页面协议：类型、Zod 校验、迁移、序列化
├── core/       @lowcode/core     纯 TS 业务核心：节点树/物料/表达式/事件/动作/数据源/规则/历史/插件/布局
├── runtime/    @lowcode/runtime  Schema 渲染器与运行时上下文（Vue，纯 render 函数）
├── materials/  @lowcode/materials 本地物料库（Element Plus 组件 + propConfigs）
├── codegen/    @lowcode/codegen  模板 AST + Prettier → Vue SFC
├── editor/     @lowcode/editor   Pinia 编辑器：画布/物料/属性/大纲面板、拖拽、快捷键
└── playground/ @lowcode/playground 可运行的示例应用
```

## 二、依赖方向（强制）

```text
Schema
  ↓
Core
  ↓
Runtime
  ↓
Editor
```

- Core 不依赖 Vue / Pinia / Element Plus / DOM。
- Runtime 只消费 PageSchema 与 Core 的接口。
- Editor 是唯一的「界面层」，所有编辑器状态都在 Pinia 中。
- materials 仅依赖 schema / core / runtime，被 editor 与 codegen 消费。

## 三、核心数据流

```text
用户动作（拖拽 / 输入 / 点击）
  → 事件入口（DnD 事件 / v-model / @click）
  → 业务抽象（DragPayload / PropConfig / EventAction）
  → 核心模块（NodeTree / History / Expression / ActionChain）
  → 状态变化（PageSchema / Pinia / Runtime State）
  → 模块协作（DataBus / 回调注入）
  → Runtime Renderer
  → UI / 副作用
```

## 四、关键抽象与其解决的问题

| 抽象 | 解决什么问题 |
| --- | --- |
| `Binding<T>` | 一个属性同时支持静态值 / 表达式，统一 Props / Style / Visible / Loop |
| `NodeTree` | 平铺 nodes 的增删改移，children 只存引用，配合 Immer 补丁 |
| `MaterialRegistry` | 动态增加组件，Renderer 不写死组件表 |
| `IExpressionEngine` | 用安全的 Jexl DSL 替代 eval / new Function |
| `ActionRegistry` | Core 不写死动作集合，插件可扩展 |
| `ActionChainRunner` | 串行 / 条件 / 异步 / 错误处理 / 中断 |
| `DataSourceManager` | 统一 loading / data / error 状态，Runtime 订阅后驱动 UI |
| `RuleEngine` | 把「条件 → 动作」声明化，支持防抖与循环依赖保护 |
| `HistoryManager` | Immer Patch 实现 undo / redo / 批量 / 合并 / 深度限制 |
| `PluginManager + HookBus` | 不修改 Core 源码即可扩展能力 |
| `RuntimeContext` | 表达式 / 数据源 / 事件 / 变量 / 弹窗状态的运行时汇聚点 |
| `IComponentResolver` | 物料类型 → Vue 组件，Editor 与 Preview 可替换解析策略 |

## 五、状态管理原则

- Core 只持有「纯数据 + 纯业务能力」，不感知 UI。
- Editor 用 Pinia 管理 `schema / selectedNodeIds / hoverNodeId / dragState / zoom / clipboard / panelState`。
- `PageSchema` 不是 Pinia 专属对象，序列化后可在任何环境恢复。
- Runtime 的变量 / 数据源状态用 Vue `reactive`，保证表达式驱动的 UI 自动更新。

## 六、一条链路的完整示例

用户在物料面板把 Button 拖到画布：

```text
MaterialPanel dragstart
  → store.setDragState({ source: 'material', materialType: 'button' })
  → Canvas 节点 dragover → DragDropManager.computeDropTarget（指针几何 → DropTarget）
  → 画布 drop → store.insertMaterial('button', target)
  → history.record：NodeTree.insert 生成 PageNode
  → PageSchema 更新（Immer 补丁入栈）
  → RuntimeRenderer 重新渲染 → 画布出现 Button
```

## 六·补、后续扩展能力

### 远程物料

```text
Remote Material Manifest
  → RemoteMaterialLoader
  → 缓存（同类型同版本命中不重复请求）
  → ESM：import(url) / UMD：script 注入全局对象
  → 提取 default / component 导出
  → 注册进 MaterialRegistry
  → Runtime 正常渲染
```

支持版本缓存、失败重试（retries / retryDelayMs）与 fallback 占位组件。物料面板提供「载入演示 / 载入 manifest URL」入口。

### 模板管理

页面可保存为模板（localStorage 持久化），支持模板导入 / 导出 / 删除 / 一键生成新页面。

### 编辑器框选与组合

- 画布空白处按住左键拖出选框，可批量选中节点（Shift 追加选择）。
- Ctrl/Cmd+G 组合选中节点为容器，Ctrl/Cmd+Shift+G 或右键菜单取消组合。
- 底层由 `NodeTree.groupAs / ungroup` 提供，移动根级节点进容器的历史 bug 已一并修复并有回归测试。

## 七、运行方式

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # Vitest 全量测试
pnpm typecheck  # tsc + vue-tsc
pnpm build      # playground 生产构建
```
