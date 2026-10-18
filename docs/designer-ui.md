# 设计器界面（顶部导航栏 / 组件库 / 页面模板 / 结构树 / 生成 SFC）

设计器三栏布局：左侧组件库（含页面模板）、中间画布、右侧属性与表单设置。
本文覆盖画布之外的交互面板；属性面板与表单设置见 [设置面板](setting-panel.md)。

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 顶部导航栏 Toolbar                                                       │
│ 品牌/版本 │ 撤销 重做 │ PC Pad H5 │ 缩放 │ 结构树 │ 清空 导入 导出 SFC 预览 │
├───────────────┬─────────────────────────────────┬───────────────────────┤
│ 组件库面板     │ 画布 Canvas                      │ 设置面板               │
│ 组件库/页面模板 │ （设备尺寸 + 拖拽落点 + 选中浮层）  │ 组件设置/表单设置/数据源 │
└───────────────┴─────────────────────────────────┴───────────────────────┘
```

## 一、顶部导航栏（Toolbar.vue）

参考 `variant-form` 的工具栏分组：左侧历史与视图，右侧页面级操作。

| 分组 | 按钮 | 行为 |
| --- | --- | --- |
| 品牌 | logo / 设计器名 / 版本 | 页面名不再占用工具栏空间（在「表单设置」里展示） |
| 历史 | 撤销 / 重做 | 走 `EditorEngine` 历史栈，无步数时禁用 |
| 视图 | PC / Pad / H5 | 切换画布设备尺寸（`state.device`） |
| 视图 | 缩放 － / 百分比 / ＋ | 画布缩放 0.3x–3x；百分比文字可点击重置为 100% |
| 结构 | 结构树 | 打开组件层次结构树抽屉 |
| 页面 | 清空 | 二次确认后清空画布（可撤销） |
| 页面 | 导入 JSON / 导出 JSON | 对话框编辑 Schema JSON，导出支持复制与 Blob 下载 |
| 页面 | 生成 SFC | 打开 SFC 对话框（懒加载 codegen） |
| 页面 | 预览 | 打开预览弹窗（表单可编辑、可校验；见下节） |

快捷键（Designer.vue）：`Delete/Backspace` 删除、`Ctrl/Cmd+C` 复制、`Ctrl/Cmd+V` 粘贴、
`Ctrl/Cmd+Z` 撤销、`Ctrl/Cmd+Shift+Z` 重做。

工具栏按窗口宽度自适应，避免设备组被挤成竖排：

| 条件 | 表现 |
| --- | --- |
| `> 1380px` | 完整文案 + 图标；设备组横向排列 |
| `≤ 1380px` | 历史 / 结构树 / 页面操作收成图标按钮（`title` 提供提示），设备与缩放保持可读 |
| `≤ 1120px` | 再隐藏设计器名称，仅保留 logo 与版本号 |
| 极窄窗口 | 工具栏横向滚动（隐藏滚动条），不再压缩/换行按钮 |

## 二、组件库面板（MaterialPanel.vue）

- **页签**：组件库 / 页面模板。
- **分组**：按物料 `category` 分组折叠，顺序为 布局 → 基础 → 表单 → 高级 → 数据 → 反馈，未知分类按名称追加；
  组标题展示该组物料数量。内部结构物料（`hidden: true`）不展示。
- **搜索**：按名称 / 类型 / 描述过滤，过滤时自动展开全部分组。
- **添加**：单击物料追加到画布根节点；拖拽物料可指定落点（`DragState` + 落点指示）。
- 物料来源为 `materialRegistry`，插件注册的物料自动出现在对应分组。
- 物料清单与移植说明见 [组件库](material-library.md)。

## 三、页面模板（templates.ts + MaterialPanel 页签）

页面模板是整页 Schema 的工厂，用于一键搭建页面骨架。

```ts
import { registerPageTemplate } from '@lowcode/editor'

registerPageTemplate({
  id: 'my-page',
  name: '我的页面',
  description: '来自后端模板库',
  tags: ['自定义'],
  create: () => schema, // 每次返回全新 Schema，避免共享可变对象
})
```

- 内置模板共 **12 个**，全部离线可用（不依赖远程 JSON 与图片）：
  - 参考 `variant-form` 的 8 个表单模板：单列表单 / 多列表单 / 分组表单 / 标签页表单 /
    主从表单 / 响应式表单 / 问卷调查表 / 固定表格表单（数据在 `template-presets.ts`）；
  - 本仓库补充的 4 个：空白页面 / 登录表单 / 数据列表页 / 卡片看板。
- 参考模板保留了参考实现的表单排版（`labelPosition: left`、`labelWidth: 150/80`、
  `labelAlign: right/left`、固定表格的紧凑行距 CSS），字段值统一映射为 `modelValue`。
- 模板卡片展示：组件总数（`countOutlineNodes`）+ 出现过的组件类型芯片 + 标签；
  「载入」在画布非空时二次确认，然后 `ctx.loadSchema()` 载入并重置历史。
- 「将当前页面存为模板」把当前 Schema 快照注册进 `templateRegistry`（仅内存，页面刷新即失效；
  需要持久化时由 playground 用 `StorageRepository.saveTemplate` 落库后在启动时注册）。
- `registerBuiltinTemplates()` 幂等，由 `initPlatform()` 调用。

## 预览弹窗（Designer.vue）

预览不再整页替换设计器，而是参考 `variant-form` 在 **`el-dialog`** 内打开：

- PC 弹窗宽度 75%；Pad / H5 自动全屏，表单宽度分别限制在 960 / 420。
- 弹窗内用 `RuntimeRenderer`（`designMode=false`）渲染，`layoutType` 跟随当前设备，
  因此字段可输入、必填/格式校验与运行态一致。
- 底部固定 5 个操作：
  | 按钮 | 行为 |
  | --- | --- |
  | 获取数据 | 先 `validateAll()`；不通过时保留红色校验提示并提示错误，通过后弹出只读 JSON 对话框（可复制） |
  | 重置表单 | 所有字段值回落到 schema 默认值，并清空校验错误 |
  | 禁用编辑 | 通过运行时 `overrides.disabled` 禁用所有声明了 `disabled` 的控件（不改 schema） |
  | 恢复编辑 | 解除上述禁用覆盖 |
  | 关闭 | 关闭弹窗；同时清空运行时覆盖，画布回到默认值 |
- 打开/关闭预览都会清空 `RuntimeContext.overrides`，避免预览里试输入的值或禁用状态泄漏回设计器。

> **外部 Schema 的可编辑性**：模板/导入的 Schema 经常省略默认属性（如字段不写
> `modelValue`、控件不写 `disabled`）。`EditorEngine` 载入时会用物料 `defaultProps`
> 补齐缺失项；否则渲染器不会把节点识别为字段（无 `v-model` 接线）、校验也不会参与，
> 表现就是"模板里的字段看起来不能编辑"。

## 四、组件层次结构树（NodeTreeDrawer.vue + outline.ts）

- 入口：工具栏「结构树」，以抽屉形式打开（`modal=false`，画布保持可交互）。
- 树结构由纯函数 `buildOutlineTree(nodes)` 生成：
  - `children` 为默认插槽内容；`slots` 中除 `default` 外的具名插槽生成**不可选中**的分组节点（`#slotName`）；
  - 被引用的节点不会重复出现在根级；重复引用只渲染一次（防御脏 Schema）；
  - 缺失引用生成 `⚠ 缺失节点` 占位（不可选中）；
  - `meta.hidden` 节点标记「已隐藏」并置灰划掉；带循环/深度保护。
- 交互：点击节点 → `selectNode(id)` 并把画布中的节点滚动到可视区；打开时与画布选中态双向同步
  （`el-tree.setCurrentKey`）；支持展开全部 / 收起全部（重建实例切换 `default-expand-all`）。
- 面板顶部展示真实组件总数（不含插槽分组与缺失占位）。

## 五、画布拖拽交互（Canvas.vue + engine/drop-target.ts）

与 `variant-form`（Sortable）一致的交互语言：

| 交互 | 行为 |
| --- | --- |
| 选中 | 单击节点选中，选中态为 `outline: 2px solid #3370ff`（不参与布局，不会引起位移） |
| 悬停 | 不显示轮廓（只保留 `cursor: pointer`），避免画布上出现虚线 |
| 拖拽手柄 | **仅选中时出现**，位于节点左上角（`top/left: -2px`，高 20px，主色底，⠿ + 组件名 + 已隐藏标记），`cursor: move`；只有手柄能发起拖拽 |
| 操作条 | 仅选中时出现，位于右下角（高 22px，主色底）：← 选中父级 · ↑ 上移 · ↓ 下移 · 复制 · 删除 |
| 拖拽浮层 | 拖拽时生成节点克隆跟随指针（轻微旋转 + 投影 + 组件名标签），原始节点 `opacity: .4` 作为占位；浏览器默认拖拽影像替换为 1×1 透明图，避免出现两个影像 |
| 插入指示条 | **3px 主色细条**（同参考实现的 `ghost` 样式），贴在目标插入位置的兄弟间隙；列表为空时贴容器内容区起点 |
| 落点判定 | 与 Sortable 一致：取指针下**最内层可接收容器**，在该容器内按子节点**主轴中线**决定插入下标（纵向列表比 y，栅格行 / 横向容器比 x）；落点容器用 2px 实线主色 outline 高亮 |
| 拖拽来源 | 组件库拖入 = 新增（`copy`）；画布内拖拽 = 移动（`move`） |
| 嵌套保护 | 拖动节点时落点若落在自身或子树内，自动收敛到其父容器 |
| 自动滚动 | 指针靠近画布边缘时自动滚动容器（rAF 循环） |
| 取消 | `Esc` 取消拖拽；拖出画布或 `dragend` 也会清理浮层与指示条 |

实现要点：

- 落点与指示条几何由纯函数 `packages/editor/src/engine/drop-target.ts` 计算（`computeListDrop` / `resolveInsertionIndex` / `resolveIndicatorRect`），DOM 只负责测量矩形，逻辑可单测。
- 落点优先用 `beforeId` 表达「插到某兄弟节点之前」，避免同容器移动时的下标偏移，也让**隐藏节点**（不参与 DOM 测量）不影响插入位置；`moveNode` / `insertMaterial` 都按 `beforeId` 解析。
- 指示条通过 `<Teleport to="body">` 以 `position: fixed` + 视口坐标渲染，绕开画布 `zoom` / `transform: scale()` 的坐标换算。
- 内部结构节点（栅格列 / 表格行 / 单元格）不渲染**拖拽手柄**；结构由属性面板的结构编辑器维护。
- 例外是栅格列：对齐参考实现，选中后在列内渲染类型标签（左上）与操作条（右下：← 选中父级 · ↑ 上移 · ↓ 下移 · 复制空列 · 删除）。操作条追加在 ElCol 的默认插槽里并绝对定位，因此不会破坏 `el-row > el-col` 结构。
- `EditorEngine.computeDropTarget`（基于悬停节点上中下三分区的几何算法）保留为引擎层 API，画布已改用上面的 DOM 测量算法。

## 六、生成 SFC（SfcDialog.vue + @lowcode/codegen）

- 工具栏「生成 SFC」→ 对话框内四个页签：**完整 SFC / Template / Script / Style**，展示文件名、行数、字符数，
  支持复制与下载（Blob，无需 file-saver）。
- 生成走 `@lowcode/codegen` 的 `generateVueSfc(schema)`：Schema → 模板 AST → Prettier → Vue 3 SFC。
- **懒加载**：`await import('@lowcode/codegen')` 独立分包，只有点击按钮时才下载（prettier 体积较大）。
- 浏览器可用性：Prettier 以 `prettier/standalone` + `babel/estree/html/postcss` 插件显式调用，
  否则浏览器端会报 `Couldn't resolve parser "vue"`；格式化失败时回退为未格式化文本（结构仍完整）。

## 七、扩展点

| 扩展点 | 用法 |
| --- | --- |
| 组件物料 | `materialRegistry.register(material)`（含 `propConfigs` / `events`） |
| 页面模板 | `registerPageTemplate(template)` / `registerPageTemplates([...])` |
| 插件 | `registerPlugin(plugin)`（动作 / 物料 / 表达式函数） |
| 远程物料 | `remoteMaterialLoader`（ESM / UMD） |

## 八、验证

- 单测：`outline.test.ts`（层级 / 插槽分组 / 缺失占位 / 隐藏标记 / 路径定位）、
  `templates.test.ts`（内置模板 Schema 合法性 / 幂等注册 / 去重 / 深拷贝隔离）。
- 浏览器交互（无头 Chrome + CDP，0 未捕获异常）：
  - 设计器界面 11 项：工具栏按钮齐备、组件库分组与搜索、单击添加、结构树层级与选中同步、
    隐藏标记、模板卡片与结构预览、载入模板后无未注册物料、SFC 四页签生成、导出 JSON 下载。
  - 拖拽交互 7 项：选中态手柄/操作条位置（左上 / 右下）与 `cursor: move`、
    画布内排序（浮层跟随 + 3px 指示条贴合目标间隙 + 落点生效）、拖拽结束无残留、
    组件库拖入空容器与追加到已有子节点之后、跨容器移动（原位置移除）、Esc 取消。
  - 组件库 7 项、设置面板 12 项、控件交互 4 项。
