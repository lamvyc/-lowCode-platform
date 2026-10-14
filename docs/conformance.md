# 组件库一致性基线（自动比对参考实现）

移植过来的组件库，最怕的是「抄漏了 / 抄歪了」而没人发现。手工逐个组件比对不可持续，
所以把参考实现变成**可执行的验收基线**：从 `variant-form` 源码自动抽取每个组件的能力面，
与我们的物料清单/组件源码机器比对，差异要么补齐、要么显式登记。

## 一、怎么跑

```bash
# 参考实现目录（默认取仓库同级的 ../variant-form/src，也可显式指定）
export VARIANT_FORM_SRC=/path/to/variant-form/src

# 跑审计（同时是普通单测的一部分）
pnpm --filter @lowcode/materials test
# 或仓库根目录
pnpm conformance
```

产物：

- `docs/conformance-report.md` —— 人读的汇总与明细（自动生成，勿手改）
- `docs/conformance-report.json` —— 机器可读明细（CI 可据此做趋势/门禁）

参考实现目录不存在时，审计用例自动跳过（`describe.skipIf`），不影响 CI 上的常规测试。

## 二、比对了什么

从参考实现抽取三类信号，逐一比对：

| 维度 | 参考侧来源 | 本仓库侧来源 | 检出问题 |
| --- | --- | --- | --- |
| **属性** | `widgetsConfig.js` 的 options 键 + 模板里真正读取的 `field.options.X` | `manifest.ts` 的 `propConfigs` | 参考有、我们没有（含重命名映射） |
| **事件** | options 中的 `onXxx` 声明 | `manifest.ts` 的 `events[].label` | 参考声明的事件我们没有 |
| **UI 绑定** | widget 模板里 `:attr="...options.X"` 的 Element UI 组件属性 | 我们 SFC 模板里的 `:attr="..."` | 参考绑定到 Element 组件、我们没绑（漏传参数） |

另外还有一条**不依赖参考实现**的自检：
`manifest.propConfigs` 里的每个属性，都必须在对应组件的 `defineProps` 中真实声明
（否则面板会写到一个组件不认识的字段上，运行时静默失效）。

## 三、怎么读报告

```text
| 参考组件 | 本仓库类型 | 状态 | 缺失属性 | 缺失事件 | 缺失 UI 绑定 |
| input    | input      | ✅   | —        | —        | —            |
```

- `✅` 完全一致（差异都已登记或不存在）
- `⚠️ 差异` 有未登记差异 —— **测试会失败**，必须补齐或登记
- `❌ 缺失` 参考有该组件、我们没实现

## 四、"有意不同" 怎么登记

确实属于架构差异或上游 UI 库差异的，登记到
`packages/materials/src/conformance/audit.ts` 的 `WAIVERS`，**必须写原因**：

```ts
{
  widget: 'radio',            // 参考 widget 类型；'*' 表示对所有组件生效
  kind: 'attr',               // widget | option | event | attr
  reference: 'elradiobutton:border', // option 名 / 事件名 / `标签:属性`
  reason: 'Element Plus 的 el-radio-button 已移除 border 属性（仅 el-radio 支持）',
}
```

当前登记的契约（11 条）分三类：

1. **事件模型差异**（`*` 通配）：`onCreated` / `onMounted` / `onValidate` —— 本平台节点事件是结构化动作链，
   不含组件生命周期与字段即时校验。
2. **承载位置差异**：栅格 `colHeight`（本平台表达为整行高度）、按钮 `displayStyle`
   （无 static-content-wrapper 外壳）、静态文本 `preWrap`（用 `white-space` 而非 `<pre>`）、
   富文本 `disabled`/`placeholder`（自研 contenteditable）。
3. **上游 UI 库差异**（Element UI 2.x → Element Plus）：`radio-button`/`checkbox-button` 的 `border`
   已移除、按钮图标用 `icon` 而非 class。

`WAIVERS` 是**契约**而不是垃圾桶：登记一条就等于承认"这里和参考不同且我们知道原因"，
新差异会因为测试失败而被拦住。

## 五、已知局限

- **UI 绑定是"存在性"检查**：只验证属性是否绑定在该标签上，不校验绑定表达式是否语义正确
  （表达式常有 computed 中转）。语义正确性由渲染类用例覆盖（见下）。
- **参考侧模板解析基于正则**，对本项目（Vue 2 单文件组件）足够；参考实现若大改模板写法需要同步调整解析器。
- 只覆盖 `widgetsConfig.js` 里注册的组件；参考的 `extension/samples/*`（扩展示例）不在范围内。

## 六、配套的运行期验收

静态比对保证"该声明的都声明了、该绑的绑了"，运行期行为另有三层用例：

- `packages/materials/src/manifest.test.ts` —— 清单完整性（控件类型合法、联动依赖存在、`defaultChildren` 引用有效等）
- 无头 Chrome 用例：**30 个组件逐个插入画布并渲染成功**、结构编辑器、拖拽交互、代码生成
- 组件 `defineProps` ↔ 清单属性一致性（见上文自检）

两层合起来，才能既保证"抄全了"，也保证"抄对了"。

## 七、本次审计直接查出的真实缺陷（示例）

用它跑第一遍就发现了人工复核很容易漏掉的问题：

1. **18 个字段组件的 `labelIconClass` / `labelIconPosition` / `labelTooltip` 是死配置** ——
   清单声明了、组件没声明也没透传给 `FormItem`，面板改了没有任何效果。已修复。
2. **5 个组件挂着不存在的 `size` 属性**（switch / rate / 图片上传 / 文件上传 / 富文本）——
   参考实现里这些组件根本没有 size，是我们从 `fieldAdvancedProps()` 里被顺带塞进去的。已移除。
3. **按钮丢了 `onClick` 事件声明** —— 组件有 `emit('click')`，清单却没有事件入口，面板里点不出事件编辑器。已补。
4. 参考把内部结构（`tab-pane` 等）渲染在父模板里，我们拆成子组件承载 ——
   审计据此调整为按「组件闭包」检查绑定，避免误报。
