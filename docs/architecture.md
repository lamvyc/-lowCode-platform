# 架构总览

## 一、包结构

```text
packages/
├── schema/     @lowcode/schema   五层协议：Page/DataModel/Process/API/Plugin 类型、Zod 校验、迁移、序列化
├── core/       @lowcode/core     纯 TS 业务核心：节点树/物料/表达式/事件/动作/数据源/规则/历史/插件/布局
├── runtime/    @lowcode/runtime  Schema 渲染器与运行时上下文（Vue，纯 render 函数）
├── materials/  @lowcode/materials 本地物料库（Element Plus 组件 + propConfigs）
├── codegen/    @lowcode/codegen  模板 AST + Prettier → Vue SFC
├── editor/     @lowcode/editor   Pinia 编辑器：画布/物料/属性/大纲面板、拖拽、快捷键
└── playground/ @lowcode/playground 可运行的示例应用
```

## 一·补、五层架构映射

将现有包结构映射到目标五层架构（前端视角，基础设施层为前端等价物）：

```text
┌──────────────────────────────────────────────────────────────┐
│ 用户交互层                                                     │
│  playground（预览挂载、应用管理仓储）  editor（设计器引擎）        │
│  可视化设计器△ | 页面预览○ | 应用管理○ | 权限管理●              │
├──────────────────────────────────────────────────────────────┤
│ Schema驱动层                                                   │
│  schema                                                        │
│  页面Schema ● | 数据模型Schema ● | 流程Schema ● | API Schema ●  │
│  插件Schema ●（统一骨架：version/kind/metadata/spec/migrations） │
├──────────────────────────────────────────────────────────────┤
│ 引擎层                                                         │
│  core（规则/API/事件/表达式/动作/表单/流程）  runtime（渲染）  codegen（编译）│
│  渲染引擎● | 表单引擎● | 流程引擎● | 规则引擎● | API引擎○         │
├──────────────────────────────────────────────────────────────┤
│ 插件层                                                         │
│  materials（组件实体）  core（插件机制/远程加载器/连接器）          │
│  自定义组件● | 自定义连接器● | 自定义函数● | 扩展面板△            │
├──────────────────────────────────────────────────────────────┤
│ 基础设施层（前端等价物）                                        │
│  core（DataBus/MemoryStorage/Auth）  playground（localStorage 仓储）│
│  数据库△ | 文件存储○ | 消息队列△ | 缓存○ | 身份认证●            │
└──────────────────────────────────────────────────────────────┘
● 完整  ○ 部分  △ 只有机制/引擎无界面  ✗ 缺失
```

### 包 ↔ 层对照

| 包 | 所属层 | 对应图中的能力 | 现状说明 |
| --- | --- | --- | --- |
| `schema` | Schema 驱动层 | 页面 / 数据模型 / 流程 / API / 插件 Schema 全 ● | 五层协议完整：统一骨架（version/kind/metadata/spec/migrations）+ semver 校验；标准 Action 枚举（P1）；三级权限模型（P2）；表达式沙箱（P3）；JSON Schema 属性面板与插件接口（P4）；旧版扁平 PageSchema 1.x 保留并支持迁移到统一 2.x（P5）。runtime/editor/playground 已可通过 `normalizePageSchema` 消费统一页面 |
| `core` | 引擎层为主，兼插件机制与基础设施 | 规则引擎 ●、API 引擎 ○、表单引擎 ●、流程引擎 △、自定义函数 ●、连接器 ●、权限 ●、认证 ● | `RuleEngine` / `EventEngine` / `ActionChainRunner` / `UnifiedActionRunner` / `JexlExpressionEngine` 是引擎主体；内置动作按标准 `ActionType` 注册（含 `submit`/`refresh` 一等实现，旧 `kind` 走别名兼容）；`FormEngine`（值/错误/touched/dirty 状态机 + validate/submit/reset + 表达式联动）与 `dataModelToFormSchema`（DataModel → 表单字段）构成表单引擎；`ProcessEngine`（解释执行 ProcessSchema：start/end/task/apiCall/dataModel/delay/condition + 实例状态机 run/completeTask/terminate）构成流程引擎；`ConnectorRegistry`（声明式连接器：baseUrl/path/auth 组装请求）+ `registerConnectorActions`（连接器动作注册进 ActionRegistry）构成连接器；`PermissionService` + 三级权限纯函数（表/字段/操作）消费 `DataModelPermissions`；`authenticatedHttpClient` + `AuthProvider` 提供会话令牌注入与 401 刷新重试；`DataSourceManager` 支持 `DataModel`/`API` ref 取数（`SchemaRegistry` 解析引用）；`PluginManager + HookBus` 是插件机制而非插件本身；`DataBus` / `MemoryStorage` 是消息队列 / 缓存的抽象层 |
| `runtime` | 引擎层 | 渲染引擎 ●、表单引擎 ●（渲染器）、流程引擎 ●（视图）、权限 ●（指令） | `RuntimeRenderer` / `RuntimeContext` / `IComponentResolver` 就是完整的解释执行渲染引擎；`FormRenderer` + `IFormWidgetResolver` + 内置纯 render 控件构成表单渲染器，`RuntimeContext.forms` 注册表把 `submit` 动作接到 `FormEngine.submit()`；`ProcessViewer` + `topologicalLayers` 把 ProcessSchema 按拓扑层级渲染并高亮当前节点；`createPermissionDirective`（v-permission）+ `usePermission`/`installPermission` 是权限的 Vue 消费端 |
| `codegen` | 引擎层（图里未单列） | 「编译引擎」 | schema → 模板 AST → Vue SFC，属于第二执行路径，本质是引擎 |
| `materials` | 插件层 | 自定义组件 ● | 本地物料 + Element Plus，是插件层的实体实现；远程组件机制在 core |
| `editor` | 用户交互层 | 可视化设计器 △ | 只有 `EditorEngine` / 节点操作 / 框选，是设计器的引擎基建，画布 / 面板 UI 已移除 |
| `playground` | 用户交互层 + 基础设施实现 | 页面预览 ○、应用管理 ○、文件存储 ○ | 运行时渲染挂载 + `StorageRepository`（页面 / 版本 / 模板仓储）+ localStorage 持久化 |

### 两点观察

1. **`core` 是唯一横跨三层的包**：既是引擎层主体，又承载插件机制（插件层的基础设施），还提供 `DataBus` / `MemoryStorage`（基础设施层抽象）。这是刻意的分层设计——core 是纯 TS 的「能力底座」，各层都通过它。
2. **按图看，缺口是「产品形态」而非「架构形态」**：五层横向骨架（Schema 契约、引擎抽象、插件注册、存储抽象、权限/认证）已在位；纵向空白仅剩「产品形态」——设计器/应用管理的界面。五层 Schema 协议已在 `schema` 包落地；统一 Action 引擎（标准 type 注册 + submit/refresh）与 DataModel/API 引用解析器（`SchemaRegistry` + `DataSourceManager` ref 取数）在 P0 落地，表单引擎（`FormEngine` + `dataModelToFormSchema`）在 P1 落地、表单渲染器（`FormRenderer` + 控件解析器 + `submit` 接线）在 P1.5 落地，流程引擎（`ProcessEngine` 解释执行 + 实例状态机）在 P2 落地、流程视图（`ProcessViewer` + 拓扑分层）在 P2.5 落地，连接器（`ConnectorDefinition` + `ConnectorRegistry` + `registerConnectorActions`）在 P3 落地，权限 + 认证（`PermissionService` + 三级权限纯函数 + `AuthProvider` + `authenticatedHttpClient`）在 P4 落地，权限的 Vue 消费端（`v-permission` 指令 + `usePermission`/`installPermission`）在 P4.5 落地；下一步落点：`materials` 补 Element Plus 表单控件（switch/number/date/textarea）、`editor` 把设计器 UI 接回 `EditorEngine`、`playground` 把应用管理做成界面。

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

## 三·补、渲染引擎执行流程

运行时渲染遵循「Schema → 解析 → 映射组件 → 实例化 → 绑定状态 → 事件/数据 → DOM」的链路：

```text
Schema JSON
  ↓ Schema 解析器（parsePageSchema 校验 → RuntimeContext 建立运行时）
PageSchema 节点树（平铺 nodes + children 引用）
  ↓ 组件映射器（IComponentResolver → MaterialRegistry）
Vue 组件实例化（renderNode / buildNode 递归生成 VNode）
  ↓ 状态管理 / 数据绑定（Vue reactive + Jexl 表达式 + 数据源状态）
事件处理（EventEngine → ActionChainRunner → 内置动作）
  ↓
API 调用（DataSourceManager）/ 规则触发（RuleEngine）
  ↓
DOM 更新（Vue 响应式驱动重渲染）
  ↓
用户看到页面
```

关键说明：本仓库存在**两条执行路径**：

1. **运行时解释路径（runtime）**：直接消费 `PageSchema`，**没有独立 AST**，`renderNode` 的递归遍历就是树遍历，这是低代码平台的标准做法；
2. **代码生成路径（codegen）**：schema → 模板 AST（`codegen/src/ast.ts`）→ Vue SFC 源码，是真正的「编译」路径，对应导出代码能力。

另外，项目当前**没有独立的流程引擎**，图中的「流程触发」由 `RuleEngine` 承担。

### 流程图 ↔ 包结构

| 流程步骤 | 实际位置 | 关键代码 |
| --- | --- | --- |
| Schema JSON | `packages/schema`：页面协议定义 + 校验 + 序列化 | `types/page.ts`（PageSchema）、`playground/src/demo-schema.ts` |
| Schema 解析器 | 格式校验在 schema 包，结构消费在 runtime 包 | `validation/validate.ts`（parsePageSchema）、`runtime/src/renderer.ts`（renderNode） |
| AST（抽象语法树） | 运行时路径无 AST；codegen 路径有真 AST | `codegen/src/ast.ts`（TemplateNode）、`codegen/src/generator.ts`（schema → Vue SFC） |
| 组件映射器 | `runtime/src/resolver.ts` + `core/src/material/registry.ts` | `IComponentResolver` / `MaterialRegistryResolver` / `CompositeResolver` → `MaterialRegistry` |
| Vue 组件实例化 | `runtime/src/renderer.ts` + `materials/src/components/` | `buildNode` 中 `h(component, props, slots)` |
| 状态管理（数据绑定） | `runtime/src/context.ts` + `core/src/expression/` + `core/src/datasource/` | RuntimeContext 的 reactive 状态、`JexlExpressionEngine`、`DataSourceManager.states` |
| 事件处理 | `core/src/event/` + `core/src/action/` | `EventEngine` → `ActionChainRunner` → `builtin.ts`（8 种内置动作） |
| API 调用 | `core/src/datasource/manager.ts` | `load / loadAll`，`builtin.ts` 的 request 动作 |
| 流程触发 | 无流程引擎，由规则引擎承担 | `core/src/rule/engine.ts`（trigger：expression / event / datasource / mount） |
| DOM 更新 | Vue 响应式 + `runtime/src/renderer.ts` | reactive 状态变化 → RuntimeRenderer 重执行 → VNode diff |
| 用户看到页面 | `playground/src/App.vue` | `RuntimeRenderer` 挂载入口 |

### 链路示例：按钮点击 → 请求数据

```text
DOM click
  → renderer.ts toOnProp('click') 生成 onClick
  → context.ts dispatchNodeEvent（event 进入表达式作用域）
  → core/event/engine.ts EventEngine.execute 收集动作链
  → core/action/chain.ts ActionChainRunner 串行执行（when / catch / continueOnError）
  → core/action/builtin.ts request 动作 → DataSourceManager.load(url)
  → datasource/manager.ts states 更新 → $datasource.xxx.data 重新求值
  → renderer.ts 重渲染拿到新数据 → Vue patch DOM
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
