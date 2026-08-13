# 附加场景 11：Code Generator

## 1. 场景

用户点「生成代码」，把当前页面导出为一份独立的 Vue SFC。

## 2. 最终效果

生成包含 template / script setup / style 的可运行单文件组件，支持 v-if、v-for、@click、:style、表达式属性。

## 3. 完整链路

```text
PageSchema → 模板 AST（el/attr/bind/on/directive）
  → script setup（数据源 ref / 变量 ref / 动作助手 / 事件处理器）
  → Prettier 格式化
  → Vue SFC 字符串
```

## 4. 核心数据结构

```ts
type TemplateNode =
  | { kind: 'element'; tag: string; attrs: Record<string, string>; children: TemplateNode[] }
  | { kind: 'text'; value: string }
  | { kind: 'comment'; value: string }
```

## 5. 核心接口

```ts
interface ICodeGenerator {
  generate(schema: PageSchema): Promise<GeneratedCode>
}
```

## 6. 工业实现

模板用 AST 构建（而非字符串拼接），未来可输出 React / HTML；Prettier 负责格式化；生成代码通过 `@vue/compiler-sfc` 解析验证。表达式中的 `$datasource.<id>.data` 被改写为对应 ref，`$page.<name>` 改写为变量。

## 7. 关键代码

```ts
const root = el('div', { class: 'lc-page' }, rootChildren)
const template = stringifyTemplate(root)
const code = await prettier.format(raw, { parser: 'vue', semi: false })
```

## 8. 调用链

```text
generate → nodeToAst → buildScript → stringifyTemplate → prettier.format → SFC
```

## 9. 数据流

```text
Schema 节点 → AST 节点 → 模板字符串 → 格式化 → 文件
```

## 10. 状态变化

- 无运行时状态；输出是确定性字符串。

## 11. 模块协作

codegen 只依赖 schema 协议；AST 层与目标语言解耦；脚本生成器负责把 schema 的能力翻译成响应式代码。

## 12. 扩展点

- 新目标：实现新的 `ICodeGenerator`（React / HTML）。
- 新语法：扩展 AST 节点与 stringify。

## 13. 面试表达

> 代码生成器把「运行时解释 schema」换成「编译 schema 成代码」：用 AST 构建模板、按数据源生成响应式脚本、用 Prettier 统一格式，并让生成的代码通过 compiler-sfc 校验，保证产物可用。
