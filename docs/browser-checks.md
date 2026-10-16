# 真机验收套件

> **一句话**：把"只有真实浏览器才暴露"的行为固化成可复跑的检查。
> `pnpm verify:browser -- --url http://localhost:5174/`

## 为什么需要它

本项目查出的 bug 几乎全是**真实浏览器里才暴露**的：

| 类型 | 例子 | 为什么单测/happy-dom 抓不到 |
| --- | --- | --- |
| 上游 CSS 语义变化 | radio 的 `displayStyle` 静默失效 | happy-dom **没有布局引擎**，`getComputedStyle` 不反映真实 flex 布局 |
| 布局引擎相关 | `inline` 与 `inline-block` 的实际差异 | 同上 |
| 原生拖拽 | 落点索引错位、排序偏移 | HTML5 DnD 由浏览器原生手势触发，合成事件驱动不了 |
| 真实事件序列 | 点上移/下移后选中态跳走（`questionBug.md` question2） | 合成 `click()` 只跑一次同步事件；真实鼠标会在事件分发中间夹一次重渲染 |
| 浮层遮挡 | 下拉浮层压住画布操作条 | 没有 `z-index` / 命中测试（`elementFromPoint`） |

这些探针原先散落在临时脚本里，跑完就没了。现在收进仓库，**一条命令全跑**。

## 怎么跑

```bash
# 另开一个终端
pnpm dev

# 然后
pnpm verify:browser -- --url http://localhost:5174/   # 建议显式指定
pnpm verify:browser -- --url http://localhost:5174/ --only radio   # 只跑名字含 radio 的
```

⚠️ **不指定 `--url` 时，如果检测到多个可用 dev server，脚本会拒绝执行并列出它们。**

这是刻意的：猜错端口会**拿旧代码当验收对象**——断言失败会被误读成"代码坏了"，
断言通过会被误读成"没问题"。两种误读都比直接报错危险。（实测踩过：`localhost:5173`
上跑着一个旧的开发服务器，第一版套件静默连上它，11 个检查里 6 个"失败"，全是假警报。）

## 检查清单

| 检查 | 守的是什么 |
| --- | --- |
| `canvas-smoke` | 画布能渲染出节点，没有降级成 `.lc-render-error` / `.lc-missing` |
| `radio-displayStyle` | EP 把 `.el-radio-group` 改成 `inline-flex` 会让选项 `display` 被块化、`displayStyle` 静默失效（已用 `:deep` 恢复 `inline-block`） |
| `checkbox-displayStyle` | `inline` 时必须显式给 `inline`，不能留空落到 EP 默认的 `inline-flex`（两者间距/基线不等价） |
| `input-placeholder` | `placeholder` 默认是空串（参考实现如此，无兜底文案），设置后透传到原生 `input` |
| `formitem-no-hint` | `requiredHint` / `validationHint` 是**校验失败时的错误文案**，不是常显提示 |
| `validation-in-preview` | 预览态：空值失焦出现错误、填值后失焦清除过期错误（纯 UI 时序） |
| `drag-ghost-follows-pointer` | 拖拽浮层的三处观感问题：① 创建时落在 (0,0) 再被 60ms transition 补间到指针（「从左上角飘过来」）② 浮层带 `rotate(1.5deg)` 导致倾斜 ③ 屏蔽浏览器默认拖拽影像的 1×1 透明元素**未挂载**，被 Chrome 忽略（「浏览器小图标」）。逐条断言 |
| `drop-at-bottom-appends` | 落点索引必须换算到 **schema children 空间**，否则隐藏兄弟（demo 的 `n_input`）会让落点整体偏移 |
| `material-drag-to-top` | 物料拖入的顶部落点 |
| `node-reorder-to-front` | `NodeTree.resolveIndex` 的 `beforeId` 对根级 `PageNode[]` 列表必须真的能匹配（否则退化成"总是追加末尾"，表现为拖不到最前） |
| `node-move-real-mouse` | 真实鼠标点上移/下移后选中态**不跳到相邻组件** |
| `cross-container-drag` | 根层节点拖进卡片后成为其子节点 |

## 三个"看起来像 UI 小毛病、其实是机制问题"的例子

都出在同一个组件上，值得放在一起看——**它们的表象都不是根因所在**：

| 表象 | 真因 |
| --- | --- |
| 浮层从左上角飘过来 | 创建时没设初始 `transform`（先在 (0,0) 渲染一帧）+ `transition: transform 60ms` 把它补间过去 |
| 浮层倾斜 | 我们自己在 `ghostTransform` 里写了 `rotate(1.5deg)` |
| 出现浏览器自带的"小图标" | `setDragImage(1×1 canvas, 0, 0)` 里的 canvas **从未 append 到 DOM**；Chrome 忽略未渲染元素，静默回退到默认影像 |

第三条尤其值得记：**代码"看着是对的"**（确实调了 `setDragImage` 去屏蔽），
但因为传入的元素不可渲染，整条调用被静默忽略。
`display:none` / `visibility:hidden` 同理会失效——必须"移出视口但保持已渲染"。

## 检查不依赖演示数据

画布**初始为空**（对齐参考实现），因此所有检查都**自己造数据**——
新增的 `insertMaterials()` 辅助函数负责连续插入物料并把新节点 id 记到 `window.__ids`。

此前有 4 条检查依赖固定的演示节点 id（`n_title` / `n_button`），
画布变空后立刻失效。这本来就是个隐患：**检查一旦依赖演示数据，
演示数据一变它就变成假失败**（或更糟——继续通过但验的是别的东西）。

## 一个诚实的边界：瞬态效果测不到

`drag-ghost-follows-pointer` 断言的是**成因**（有没有 transition、浮层在不在指针旁），
**不是那一帧的视觉效果**——因为测量发生在拖拽稳定之后，而"从左上角飘过来"是瞬态。

回退修复后复测可以印证：`距指针` 仍是 2px、`在左上角` 仍是 false，只有
`transition` 变成 `0.06s` 才暴露出问题。

要直接观测瞬态需要"在 dragstart 与首次 mousemove 之间求值"的能力，
当前 `--steps` 的步骤粒度表达不了。**这类"只能靠成因断言"的情况要显式写清楚**，
免得后人以为它守住了视觉效果。

## 反向验证（套件本身的可信度）

写完检查不等于检查有用。**逐条把对应实现回退，确认相应用例会变红**：

| 回退内容 | 结果 |
| --- | --- |
| Checkbox 改回条件绑定 | ✅ `checkbox-displayStyle` 失败（`computed: inline-flex`） |
| 去掉落点索引的可见→schema 换算 | ✅ `drop-at-bottom-appends` 失败，详情直接显示 `[n_title, n_select, n_input, n_table, NEW, n_button]` |
| `provide` 改回直接传 context（见 `interaction-spec` 7.5） | ✅ 失败 |
| radio 改回"仅 block 才设样式" | ✅ 失败 |
| 让 `onUpdate:modelValue` 写回变空操作 | ✅ 失败 |

## 底层工具

套件只是编排层；实际驱动在 `scripts/cdp-inspect.mjs`（用 CDP 控制无头 Chrome，
**只用 Node 24 内置的 `WebSocket`，不引入 puppeteer / playwright**）。

也可以单独用它做一次性排查：

```bash
node scripts/cdp-inspect.mjs --url http://localhost:5174/ --wait ".lc-canvas" \
  --eval "document.title" --click ".lc-node" --out /tmp/shot.png
```

### 踩过的坑（都写进脚本注释了，这里汇总）

| 坑 | 现象 | 处理 |
| --- | --- | --- |
| Chrome 自身沙箱在受限环境起不来 | CDP 连上后立刻 **SIGTRAP 崩溃**，表现为"脚本静默 exit 0" | 加 `--no-sandbox --disable-setuid-sandbox --disable-breakpad --disable-crashpad`；并把 ws 关闭/Chrome 退出显式报出来 |
| vite dev server 只绑 IPv6 | `127.0.0.1` 连不上，`localhost` 可以 | 探测与断言都走 `localhost` / `[::1]` |
| 原生拖拽的 `dragover` 是**节流**的 | 插值循环结束后最后一次 `dragover` 还停在路径中间，断言读到**过期状态**（会把工具问题误判成应用 bug） | 终点再显式发一次 `mouseMoved` 并多停 400ms |
| 参数是"分阶段"的 | `--click/--type/--eval` 会先跑完所有点击再跑所有输入，无法表达"点击→断言→再输入→再断言" | 用 `--steps` 严格按序执行 |
| Element Plus 输入框要先 focus 才 emit blur | 裸 `blur` 不触发 `useFocusController` | 交互序列写成 focus → blur |

## 与其它验证层的关系

```
静态一致性审计   packages/materials/src/conformance/audit.test.ts      声明面：props / events / 绑定
上游样式审计     packages/materials/src/conformance/upstream-css.test.ts 上游语义面：CSS 布局属性差异
组件级单测       packages/materials/src/components/*.test.ts            DOM 行为（happy-dom，无布局）
──────────────────────────────────────────────────────────────────
真机验收套件     scripts/browser-checks.mjs                            ← 只有真实浏览器能覆盖的那层
```

审计负责**列出嫌疑**，套件负责**确认有没有影响**。两者缺一不可。

## 已知覆盖不到

- **纯视觉观感**：间距好不好看、对齐舒不舒服——需要人看截图（`--out` 可以存图）。
- **拖拽边缘自动滚动**（`startAutoScroll`）：未覆盖。
- **`tab-pane` / `layout-table-cell` 落点**：只覆盖了 `card` 与 `grid-col`，不过它们同构。
- **画布内拖拽的中间态视觉**（幽灵层跟随、落点指示器位置）：只断言了存在性与清理，没断言位置。
