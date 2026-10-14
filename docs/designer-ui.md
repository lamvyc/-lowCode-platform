# 设计器界面（顶部导航栏 / 组件库 / 页面模板 / 结构树 / 生成 SFC）

设计器三栏布局：左侧组件库（含页面模板）、中间画布、右侧属性与表单设置。
本文覆盖画布之外的交互面板；属性面板与表单设置见 [设置面板](setting-panel.md)。

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 顶部导航栏 Toolbar                                                       │
│ 品牌/页面名 │ 撤销 重做 │ PC Pad H5 │ 缩放 │ 结构树 │ 清空 导入 导出 SFC 预览 │
├───────────────┬─────────────────────────────────┬───────────────────────┤
│ 组件库面板     │ 画布 Canvas                      │ 设置面板               │
│ 组件库/页面模板 │ （设备尺寸 + 拖拽落点 + 选中浮层）  │ 组件设置/表单设置/数据源 │
└───────────────┴─────────────────────────────────┴───────────────────────┘
```

## 一、顶部导航栏（Toolbar.vue）

参考 `variant-form` 的工具栏分组：左侧历史与视图，右侧页面级操作。

| 分组 | 按钮 | 行为 |
| --- | --- | --- |
| 品牌 | logo / 设计器名 / 版本 / 页面名 | 页面名取自 `schema.meta.name` |
| 历史 | 撤销 / 重做 | 走 `EditorEngine` 历史栈，无步数时禁用 |
| 视图 | PC / Pad / H5 | 切换画布设备尺寸（`state.device`） |
| 视图 | 缩放 －/＋/100% | 画布缩放 0.3x–3x |
| 结构 | 结构树 | 打开组件层次结构树抽屉 |
| 页面 | 清空 | 二次确认后清空画布（可撤销） |
| 页面 | 导入 JSON / 导出 JSON | 对话框编辑 Schema JSON，导出支持复制与 Blob 下载 |
| 页面 | 生成 SFC | 打开 SFC 对话框（懒加载 codegen） |
| 页面 | 预览 | 切换预览模式（RuntimeRenderer 全量渲染） |

快捷键（Designer.vue）：`Delete/Backspace` 删除、`Ctrl/Cmd+C` 复制、`Ctrl/Cmd+V` 粘贴、
`Ctrl/Cmd+Z` 撤销、`Ctrl/Cmd+Shift+Z` 重做。

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

- 内置模板：空白页面 / 登录表单 / 数据列表页 / 卡片看板，全部离线可用（不依赖远程 JSON 与图片）。
- 模板卡片展示：组件总数（`countOutlineNodes`）+ 出现过的组件类型芯片 + 标签；
  「载入」在画布非空时二次确认，然后 `ctx.loadSchema()` 载入并重置历史。
- 「将当前页面存为模板」把当前 Schema 快照注册进 `templateRegistry`（仅内存，页面刷新即失效；
  需要持久化时由 playground 用 `StorageRepository.saveTemplate` 落库后在启动时注册）。
- `registerBuiltinTemplates()` 幂等，由 `initPlatform()` 调用。

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

## 五、生成 SFC（SfcDialog.vue + @lowcode/codegen）

- 工具栏「生成 SFC」→ 对话框内四个页签：**完整 SFC / Template / Script / Style**，展示文件名、行数、字符数，
  支持复制与下载（Blob，无需 file-saver）。
- 生成走 `@lowcode/codegen` 的 `generateVueSfc(schema)`：Schema → 模板 AST → Prettier → Vue 3 SFC。
- **懒加载**：`await import('@lowcode/codegen')` 独立分包，只有点击按钮时才下载（prettier 体积较大）。
- 浏览器可用性：Prettier 以 `prettier/standalone` + `babel/estree/html/postcss` 插件显式调用，
  否则浏览器端会报 `Couldn't resolve parser "vue"`；格式化失败时回退为未格式化文本（结构仍完整）。

## 六、扩展点

| 扩展点 | 用法 |
| --- | --- |
| 组件物料 | `materialRegistry.register(material)`（含 `propConfigs` / `events`） |
| 页面模板 | `registerPageTemplate(template)` / `registerPageTemplates([...])` |
| 插件 | `registerPlugin(plugin)`（动作 / 物料 / 表达式函数） |
| 远程物料 | `remoteMaterialLoader`（ESM / UMD） |

## 七、验证

- 单测：`outline.test.ts`（层级 / 插槽分组 / 缺失占位 / 隐藏标记 / 路径定位）、
  `templates.test.ts`（内置模板 Schema 合法性 / 幂等注册 / 去重 / 深拷贝隔离）。
- 浏览器交互（无头 Chrome + CDP，11/11 通过、0 未捕获异常）：
  工具栏按钮齐备、组件库分组与搜索、单击添加、结构树层级与选中同步、隐藏标记、
  模板卡片与结构预览、载入模板后无未注册物料、SFC 四页签生成、导出 JSON 下载、控制台无错误。
