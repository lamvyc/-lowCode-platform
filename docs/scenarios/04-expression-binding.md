# 场景 4：表达式绑定

## 1. 场景

用户给 Button 的 disabled 属性绑定表达式 `user.loading`，运行时 loading 为 true 时按钮自动禁用。

## 2. 最终效果

表达式驱动 UI：数据变化后按钮禁用状态自动切换，无需手动刷新。

## 3. 完整链路

```text
PropsPanel 选择表达式
  → 保存 Binding{type:'expression', value:'user.loading'}
  → PageSchema
  → Runtime Renderer 读取节点 props
  → IExpressionEngine.evaluate
  → ExpressionContext（local/loop/page/datasource/global）
  → disabled 值 → Vue 响应式更新
```

## 4. 核心数据结构

```ts
type Binding<T> =
  | { type: 'static'; value: T }
  | { type: 'expression'; value: string }

interface ExpressionContext {
  local?: Record<string, unknown>
  loop?: Record<string, unknown>
  page?: Record<string, unknown>
  datasource?: Record<string, unknown>
  global?: Record<string, unknown>
}
```

## 5. 核心接口

```ts
interface IExpressionEngine {
  evaluate<T>(expression: string, context?: ExpressionContext): T
  tryEvaluate<T>(expression, context): { ok: true; value: T } | { ok: false; error: string }
  addFunction(name, fn): void
}
```

## 6. 工业实现

使用 **Jexl**（安全表达式 DSL）：不执行任意 JavaScript，天然满足「禁止 eval / new Function」。引擎内置 `count`、`contains`、`toUpper` 等安全函数弥补 Jexl 不支持数组 `.length` 的缺口，并把 `===` 规范化为 `==`。作用域合并：顶层展开 + `$datasource` / `$page` 命名空间。

## 7. 关键代码

```ts
resolveProp(node, propName, loop) {
  const raw = node.props[propName]
  if (isExpressionBinding(raw)) {
    return this.expression.tryEvaluate(raw.value, this.buildExpressionContext(loop)).value
  }
  return raw
}
```

## 8. 调用链

```text
渲染 → RuntimeContext.resolveProp → JexlExpressionEngine.evaluate → 表达式结果 → 组件 prop
```

## 9. 数据流

```text
Binding 字符串 → 规范化（=== → ==）→ Jexl AST → 上下文合并 → 求值结果 → UI
```

## 10. 状态变化

- 数据源 / 变量变化（reactive）→ 表达式重新求值 → props 变化 → Vue 更新。

## 11. 模块协作

Schema 声明 Binding，Runtime 负责求值，DataSourceManager / variables 提供响应式数据源，Vue 的响应式系统完成最终 UI 更新。

## 12. 扩展点

- 新函数：`expressionEngine.addFunction` 或插件 `api.addFunction`。
- 新作用域：在 `ExpressionContext` 增加命名空间并在 `mergeContext` 展开。

## 13. 面试表达

> 表达式绑定把「数据 → UI」的关系声明化：属性值可以是表达式字符串，运行时通过 Jexl 安全求值，上下文包含五级作用域。因为数据源和变量都是 Vue reactive，数据一变表达式就重新求值，UI 自动更新——这就是低代码平台「表达式驱动 UI」的底层机制。
