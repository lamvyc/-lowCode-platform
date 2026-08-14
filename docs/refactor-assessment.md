# 重构取舍评估：哪些代码可留作架子，哪些应舍弃

> 目的：在重构前明确「留 / 修 / 弃」的边界。结论基于代码盘点与现有测试证据（86 个测试全绿，其中 editor/materials/playground 无自动化测试）。

## 一、总体结论

- **能当架子的核心资产**：`@lowcode/schema`（协议层）、`@lowcode/core` 的大部分业务模块、`@lowcode/runtime`（渲染器）、`@lowcode/materials`（物料声明）。
- **必须修一个实现级 bug**：`NodeTree` 的「就地修改契约」被破坏，这是「拖入的组件无法删除」的根因（见下）。
- **建议舍弃重建的部分**：editor 的组件层与 store 的组织方式、playground 的存储层。它们不是「不能修」，而是「修的成本接近重写，且重写后测试与可维护性显著更好」。
- 架构方向本身是对的（Schema → Core → Runtime → Editor 单向依赖、Core 不碰 Vue），**不要推翻架构，只重构实现**。

## 二、删除 bug 根因（证据）

Editor 的所有 schema 修改都通过 Immer 配方：

```ts
this.commit((draft) => {
  new NodeTree(draft.nodes).remove(id) // ← 问题在这里
}, 'remove')
```

而 `NodeTree.remove()` 内部是：

```ts
this.nodes = this.nodes.filter((node) => node.id !== id && !descendants.includes(node.id))
```

`this.nodes = ...` 把 `NodeTree` 内部引用指向**新数组**，但 `draft.nodes` 仍指向**旧数组**。Immer 看不到任何修改 → `patches.length === 0` → `history.record` 直接返回原 schema → 删除无效。

对照工作正常的操作即可确认规律：

| 操作 | 实现方式 | 是否生效 |
| --- | --- | --- |
| `insert` | `push / splice`（就地） | ✅ 拖入有效 |
| `updateProps` | `nodes[index] = next`（就地） | ✅ 改属性有效 |
| `remove` | `this.nodes = filter(...)`（换引用） | ❌ 删除无效 |
| `move` 到根级 | `this.nodes = filter(...)`（换引用） | ❌ 根级移动/取消组合无效 |
| `ungroup` | 依赖 move 到根级 | ❌ 取消组合无效 |

**结论**：模块设计没错，是实现违背了「NodeTree 就地修改、供 Immer draft 消费」的契约。修法是全部改为 `splice` 原地删除，并补一条「Immer draft + NodeTree」回归测试。

## 三、逐包判定

### ✅ 可以完全不动（当架子）

| 包/模块 | 理由 |
| --- | --- |
| `@lowcode/schema`（全部） | 协议层：类型 + Zod + 迁移链 + 序列化；6 测试；无框架依赖；API 稳定 |
| core `expression` | Jexl 引擎 + 作用域合并 + 函数注册，禁止 eval/new Function，设计正确 |
| core `action/*` | ActionRegistry + ActionChainRunner（串行/条件/异步/错误/中断），行为有 9 个测试 |
| core `datasource/manager` | 状态机 + HttpClient/Storage 注入，7 个测试；**小修**见下（公有字段） |
| core `history/manager` | Immer patch undo/redo/合并/深度限制，5 个测试 |
| core `plugin/*` | PluginManager + HookBus + PluginAPI，扩展模型完整 |
| core `layout/grid` | 纯数学，无耦合 |
| core `drag-drop/manager` | 几何→DropTarget 的纯转换；两个参数未用（小修项） |
| core `remote-material/loader` | 缓存/重试/fallback/ESM/UMD，7 个测试 |
| `@lowcode/runtime` | RuntimeContext + 纯 `h()` 渲染器；SSR 测试通过；编辑器与预览共用；**小修**见下 |
| `@lowcode/materials` | 声明式物料（defaultProps + propConfigs + SFC），与 UI 解耦 |
| `@lowcode/codegen` 的 `ast.ts` | 模板 AST 层，独立可复用 |

### 🔧 小修（保留模块，改实现，不重写）

| 模块 | 问题 | 修法 |
| --- | --- | --- |
| core `node-tree` | 换引用而非就地修改，破坏 Immer draft 契约（删除 bug 根因） | 全部改为 splice 原地操作 + Immer 回归测试 |
| runtime `context.ts` | 为兼容 vue-tsc 模板类型检查，把 `DataSourceManager` 内部字段改成 public | 改用结构化接口（如 `RuntimeContextLike`）作为 Renderer prop 类型，字段改回 private |
| core `datasource/manager` | 同上，`sources/states/listeners/timers/fetch/setState` 被公有化 | 字段私有化 + 通过接口暴露 |
| core `drag-drop/manager` | `payload` / `rootRect` 参数声明未使用 | 补根区域边界逻辑，或删除未用参数 |
| editor store 的动作逻辑 | paste/group/ungroup 与 Pinia 绑死，无法单测 | 把纯逻辑抽成函数（`applyPaste(tree, source)` 等），store 只做调用 |

### ❌ 建议舍弃/重建（成本接近重写，重写收益大）

| 部分 | 问题 | 重建方向 |
| --- | --- | --- |
| editor `store/editor.ts`（组织方式） | 模块级 `editorHistory / editorRuntime` 单例（第 33-34 行）逃出 Pinia，非常规、多页面/SSR 有状态泄漏风险；state/getters/actions 混合 | 抽 `EditorEngine`（纯 TS、可单测）持有 schema/history/runtime；Pinia 只存视图状态（selected/zoom/clipboard/panel） |
| editor `PropsPanel.vue`（259 行单文件） | 属性/绑定/样式/事件/节点五段逻辑挤在一个组件 | 拆为 `PropField` 表单框架 + 独立控件 + `BindingSwitch`，事件区独立组件 |
| editor `Canvas.vue` / `CanvasNode.vue` | 节点深度恒为 0；几何用绝对坐标 Map + ResizeObserver 注册，与 DropIndicator 强耦合；框选逻辑混在画布组件里 | 每个节点自持 `useNodeGeometry` composable，或统一 Provide/Inject 的 RenderContext；框选抽成 `useLassoSelect` |
| editor `DropIndicator.vue` | 依赖外部注入的 rect Map，坐标系换算散落 | 随 Canvas 重构一起简化，或改为渲染层直接提供 |
| playground `storage.ts` | localStorage 直写、三个 key 各自为政、无校验 | 统一仓储接口 + `@lowcode/schema` Zod 校验 + 可替换后端实现 |
| codegen `generator.ts` 的 `buildScript`（约 120 行） | 字符串拼接生成 JS，难维护 | 若作产品功能：改用 `@vue/compiler-sfc` 或真实 AST；若只作演示：保留但标注 |
| editor `platform.ts` 的 UMD 适配器 | script 注入无 cleanup/超时，演示级 | 保留（演示）或重写为带超时/卸载的加载器 |

## 四、工程化缺口（重构后应补）

- editor/materials/playground 无自动化测试 → 重构前提：先给抽出来的纯逻辑补单测。
- 无 ESLint / Prettier 配置、无 CI。
- 包 exports 指向 `src`（源码消费），只适合 monorepo 内部；若要发布需补构建配置。
- `vue-tsc` 私有字段问题的修法应落到「接口隔离」而不是「公有化字段」。

## 五、建议的重构顺序

1. **第 0 步（约 10 分钟）**：修 `NodeTree` 就地修改契约 + Immer 回归测试 → 恢复删除/移动/取消组合。
2. **第 1 步**：抽 `EditorEngine`（纯 TS），Pinia 只留视图状态；把 paste/group 等逻辑变纯函数并补测试。
3. **第 2 步**：拆 PropsPanel；重构 Canvas/CanvasNode 几何与框选。
4. **第 3 步**：统一 playground 仓储层（Zod 校验 + 可换后端）。
5. **第 4 步**：补 ESLint/Prettier/CI 与编辑器测试。

## 六、一句话总结

> **保留**：schema 协议、core 业务模块（NodeTree 修复后）、runtime 渲染器、materials、codegen 的 AST 层。
> **舍弃重建**：editor 的 store 组织方式与主要组件（PropsPanel/Canvas/CanvasNode）、playground 存储层。
> **架构方向**：不动。
