# 组件库（物料清单）

按 `variant-form` 的组件库逐项移植。共注册 **33 个物料**：28 个在组件库面板展示，5 个为内部结构 / 旧版兼容物料。
（本平台早期的「容器」「弹窗」两个额外物料已按要求移除，不再注册。）

```text
布局   grid 栅格(自动 2 列) · grid-col 栅格列(内部) · layout-table 布局表格(自动 2×2)
       layout-table-row 表格行(内部) · layout-table-cell 单元格(内部)
       tab 标签页(自动 2 个面板) · tab-pane 标签页(内部) · card 卡片
基础   static-text 静态文本 · html-text HTML 文本 · button 按钮 · divider 分割线 · image 图片 · text 文本(旧版·不展示)
表单   input 输入框 · textarea 多行文本 · number 计数器 · radio 单选框 · checkbox 复选框 · select 下拉选择
       time 时间选择 · time-range 时间范围 · date 日期选择 · date-range 日期范围 · switch 开关
       rate 评分 · color 颜色选择 · slider 滑块 · cascader 级联选择
高级   picture-upload 图片上传 · file-upload 文件上传 · rich-editor 富文本
数据   table 数据表格
```

## 一、实现结构

| 文件 | 职责 |
| --- | --- |
| `packages/materials/src/manifest.ts` | **纯声明**：类型 / 分类 / 默认属性 / 属性面板配置 / 事件 / 插槽 / 内部结构 |
| `packages/materials/src/materials.ts` | 把清单与组件实现（`MATERIAL_COMPONENTS`）合并为 `LOCAL_MATERIALS` |
| `packages/materials/src/components/*.vue` | 组件实现（Element Plus） |
| `packages/materials/src/components/FormItem.vue` | 表单字段外壳：标签 / 必填 / 校验提示 |

清单与实现分离的好处：`manifest.test.ts` 可在**不编译 SFC** 的纯 Node 环境下校验清单完整性。

## 二、表单字段外壳（FormItem）

字段类物料统一用 `<FormItem>` 包裹控件，它负责：

- 标签渲染：`label` / `labelHidden` / `labelWidth` / `labelAlign` / `labelIconClass` / `labelIconPosition` / `labelTooltip`；
- 必填标记与提示：`required` + `requiredHint`，以及 `validationHint`；
- **表单排版设置**：标签位置（`left` / `top`）、标签宽度、对齐方式从 `settings.form` 读取，
  「表单设置」面板的改动会即时反映到画布与运行时（之前这三项只是声明式元数据，现在真正生效）。

每个字段物料的属性面板都包含：标签、必填、必填提示（通用）+ 校验规则、校验提示、尺寸、标签排版、
图标、控件宽度（高级）+ 组件特有属性。

## 三、容器的节点模型

本平台是**平铺节点数组 + children/slots 引用**，与参考实现的嵌套对象模型不同：

- `children` 承载默认插槽，`slots` 只保留具名插槽（`NodeFactory` 不再写入 `slots.default`）；
- 物料可声明 `defaultChildren`，插入容器时**自动创建内部结构**：
  - `grid` → 2 个 `grid-col`
  - `layout-table` → 2 行 × 2 单元格
  - `tab` → 2 个 `tab-pane`
- 内部结构物料标记 `hidden: true`，不在组件库展示，但可在画布中选中并在属性面板配置；
- 行 / 列数量通过**结构编辑器**调整（`control: 'structure'`）：
  | 物料 | 编辑器 | 行为 |
  | --- | --- | --- |
  | `grid` | 栅格列 | 逐列设置宽度（1–24）、增加/删除列（列数不设上限），点击列可跳转到画布中的该列；新列宽度按参考实现自动补足 24 |
  | `layout-table` | 表格结构 | 调整行数 / 列数，可跳转到单元格 |
  | `tab` | 标签页 | 增删标签页、改名、排序 |

`droppable` 现在是**真实约束**：`EditorEngine.computeDropTarget` 会校验目标物料是否声明 `droppable`，
不再允许把组件拖进按钮之类的叶子节点。栅格 / 布局表格 / 标签页本身不可放入，必须落到列 / 单元格 / 面板内。

## 四、两个必须遵守的渲染约定

移植过程中修复了两处会导致「组件看起来没渲染」的问题，扩展物料时需注意：

1. **`slots.default` 不得覆盖 `children`**
   物料声明 `slots: ['default']` 时，工厂曾写入 `slots.default = []`，而渲染器随后用空数组覆盖了
   由 `children` 构建的默认插槽 —— 通过组件库创建的容器**子节点全部不渲染**。
   现在：工厂只写具名插槽，渲染器也显式跳过 `default`。

2. **布局容器内不套节点包裹层**
   画布为每个节点渲染 `.lc-node` 包裹层（承载选中态 / 拖动浮层）。但 `el-row` 要求直接子级是 `el-col`、
   表格要求 `tbody > tr > td`，插入包裹层会破坏布局。
   现在：父级为 `grid` / `layout-table` / `layout-table-row` 的节点改为**嵌入式包裹** —— 直接复用组件根
   vnode，合并选中态 class 与事件，用 `outline` 表达选中（不占用布局）。这类节点不渲染拖动浮层，
   结构由结构编辑器维护。

## 五、命名约定与差异

| 主题 | 说明 |
| --- | --- |
| 字段值 | 统一 `modelValue`，面板显示为「默认值」；运行时即实时值（参考实现用 `defaultValue`） |
| 选项 | `select` / `radio` / `checkbox` 用 `optionItems`（`select` 仍兼容旧 `options` 别名） |
| 标签页标识 | `paneName`，避免与节点级「唯一名称」`props.name` 冲突 |
| 布局表格 | 类型名 `layout-table`，避免与既有数据表格 `table` 冲突 |
| 旧版文本 | 类型 `text` 保留注册但不在组件库展示，既有页面继续可用；新页面请用 `static-text` |
| 已移除物料 | `container` 容器与 `dialog` 弹窗已从物料库删除：内置模板改以「卡片 / 栅格」承载布局，演示页改为扁平根节点；如既有页面用到它们会渲染为「未注册物料」 |
| `size` | `''` 表示跟随默认，组件内部转 `undefined` 传给 Element Plus |
| 上传 | `uploadURL` 为空时使用本地预览 / 本地文件，非空时用 XHR 上传（含 `withCredentials`） |
| 富文本 | 自研轻量编辑器（`document.execCommand`），**不引入第三方富文本库** |
| 富文本/HTML | `html-text` 与富文本按 HTML 原样渲染，不做净化 |

已知限制（Element Plus 2.14 行为）：`switch` 的 `activeColor` / `inactiveColor` 已从 ElSwitch 移除，
需要 CSS 变量 `--el-switch-on-color` 才能生效；`number` 的 `controlsPosition: 'left'` 会回落为默认布局。

## 六、扩展一个新物料

1. 在 `packages/materials/src/components/` 写组件（字段类用 `<FormItem>` 包裹）；
2. 在 `manifest.ts` 追加声明（`propConfigs` 的 `control` 取 `PropControlType`，联动用 `visibleWhen`）；
3. 在 `materials.ts` 的 `MATERIAL_COMPONENTS` 注册 type → 组件；
4. 在 `packages/materials/src/index.ts` 导出组件；
5. 若要参与代码生成，在 `packages/codegen/src/generator.ts` 的 `DEFAULT_MATERIALS` 增加映射；
6. 跑 `pnpm --filter @lowcode/materials test`（清单完整性会自动校验新物料）。

## 七、验证

- **清单完整性单测**（12 项）：参考组件库 29 个类型全覆盖、控件类型受支持、`visibleWhen` 依赖存在、
  同物料属性名唯一、`select/radio/checkbox` 必须声明 options、`defaultChildren` 引用有效、隐藏物料必须被引用等。
- **渲染与结构浏览器用例**（无头 Chrome + CDP，7 项全通过、0 控制台错误）：
  30 个组件逐个插入并渲染成功且属性面板可渲染、栅格默认 2 列并可调整为 3 列、
  布局表格自动 2×2、标签页自动 2 面板、结构树展示嵌套内部节点、生成 SFC 含 35 个物料导入。
- 回归：设置面板 12 项 + 控件交互 4 项 + 导航栏 / 模板 / 结构树 / SFC 11 项全部通过。
