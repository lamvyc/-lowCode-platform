# 属性 → 渲染 的效果扫描

> 工具：`scripts/props-effect.py`。实测得出，不读代码推测。

## 为什么需要它

画布级 A/B **只对比默认状态**。而用户最常碰到的 bug 是**改了设置没反应**——
这一类在默认状态下完全看不出来。

**已经抓到过一个真的**：单选项的 `displayStyle`，属性面板写了、画布不响应
（EP 把 `.el-radio-group` 从 `inline-block` 改成了 `inline-flex`，选项被块化，
所以 `display: inline` 永远不生效）。当时静态审计 28/28 全绿、画布 A/B 也看不出来。

## 做法

对每个物料的每个可设属性：

1. 插入物料 → 取一次 DOM 指纹
2. `ctx.updateProps(id, { [prop]: 测试值 })` → 再取指纹
3. 比较是否变化

指纹 = 该节点子树的 `outerHTML` + **表单控件的 live property**（`value`/`checked`/`disabled`/`readOnly`）+ 外框尺寸。

整个扫描在**一次 CDP eval** 里跑完（`awaitPromise: true`），约 40 秒。

## 结果

**513 个属性：396 有反应（77%）/ 64 被 `visibleWhen` 下闸 / 39 需人工判定 / 14 跳过。**

### 关键分界：有没有被 `visibleWhen` 下闸

属性面板用 `visibleWhen` 把次级属性藏在条件下（如「显示字数统计」只在设了最大长度后出现）。
被下闸的属性在默认状态下改了当然没反应，**这是设计意图，不是 bug**。

只有**没被下闸却没反应**的才是真候选。

### 39 个真候选的归类（全部可解释，无未解之谜）

| 类别 | 属性 | 原因 |
| --- | --- | --- |
| 需要有值才看得出来 | `clearable`(×6)、`format`(×4)、`valueFormat`(×2)、`modelValue`(×3) | 空选择器不显示清除图标、没有值就没有可格式化的文本 |
| 上传的服务端参数 | `uploadURL`、`limit`、`fileMaxSize`、`withCredentials`（各 ×2） | 只影响请求，设计态无视觉 |
| 需要前置条件 | `multiple`、`allowCreate`、`automaticDropdown`、`activeName`、`lowThreshold`、`highThreshold`、`step`、`checkStrictly`、`showAllLevels` | 空的多选与空的单选渲染完全相同；阈值/步长在无数据时无视觉 |
| 富文本专属 | `placeholder`、`minLength`、`maxLength` | Quill 的 placeholder 走 JS property，不在 `outerHTML` 里 |

**结论：没有发现未解释的"改了没反应"。** 说明这一类 bug 在当前代码里并不普遍
——真正抓到的只有早先单选项 `displayStyle` 那一个。

## ⚠️ 探针自身踩过的 5 个坑（都会造成"假 bug"）

这些坑的共同点：**探针写错会造出假 bug，比漏报更危险**——你会去修一个不存在的问题。

| # | 坑 | 表现 |
| --- | --- | --- |
| 1 | `insertMaterial` 后立刻查 DOM | 全部 `NO_NODE`（DOM 更新在下一个 tick） |
| 2 | 指纹只比 `outerHTML` | `<input>` 的当前值是 **property** 不是 attribute，`modelValue` 被误判成没接线 |
| 3 | 测试值给 `'EFFECT'` | `font-size: EFFECT` 是非法 CSS，浏览器直接忽略 → `columnWidth` / `fontSize` 被误判 |
| 4 | override 不看类型 | 卡片的 `width` 是 CSS 字符串（`'100%'`），图片的 `width` 是数字（200）；套 `'300px'` 后图片变成 `300pxpx`（非法） |
| 5 | 测试值等于默认值 | `gutter: 12` 而默认就是 12，等于没改 |

## 基线守卫

脚本末尾有 `BASELINE_SUSPICIOUS = 39`：**一旦"未被下闸却无反应"的属性变多就以非零码退出**。

这样以后某个属性新出现"改了没反应"，会被立刻抓到。

## 已知局限

- 只验了"**有没有**反应"，没验"**反应对不对**"（这层靠 `browser-checks.mjs` 里的精确断言兜底）
- 需要前置状态的属性（如上表）无法用单属性扫描覆盖，需要构造场景
- 只在设计态扫，没扫预览/运行态

## 怎么跑

```bash
# 需要 dev server（5174）
python3 scripts/props-effect.py            # 全量
python3 scripts/props-effect.py input      # 只扫指定物料
```
