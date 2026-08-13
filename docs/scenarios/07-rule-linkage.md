# 场景 7：组件联动（规则引擎）

## 1. 场景

Select 选择「其他」后，Input 自动显示。

## 2. 最终效果

选择「其他」→ 条件命中 → Input 可见性变为 true；切回其他选项 → 条件不命中 → Input 隐藏。

## 3. 完整链路

```text
Select change
  → setVariable（selectValue 更新，reactive）
  → 表达式上下文变化
  → Input.visible 绑定求值（selectValue === "其他"）
  → Runtime Renderer 重建该节点
  → UI 更新
```

> 说明：本项目把「组件联动」同时支持两种实现——① 属性直接绑定表达式（示例页采用，最简单）；② 声明式 Rule 规则引擎（下面描述），适用于需要执行动作链的联动。

## 4. 核心数据结构

```ts
interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: 'expression' | 'event' | 'datasource' | 'mount'
  condition: string          // Jexl 表达式
  actions: EventAction[]     // 命中后执行
  debounceMs?: number
  dependsOn?: string[]
}
```

## 5. 核心接口

```ts
class RuleEngine {
  evaluate(rule, context): boolean
  run(rules, expressionContext, actionContext): Promise<RuleRunResult[]>
}
```

## 6. 工业实现

- 条件用 Jexl 求值，动作用 ActionChainRunner 执行。
- 拓扑排序尊重 `dependsOn`，循环依赖不会死循环（环内规则按原顺序兜底）。
- `debounceMs` 防止重复触发。

## 7. 关键代码

```ts
const matched = this.evaluate(rule, expressionContext)
if (!matched) { results.push({ rule, matched: false }); continue }
actionResults = await new ActionChainRunner(actionRegistry, actionContext).run(rule.actions)
```

## 8. 调用链

```text
状态变化 → RuleEngine.run → 条件求值 → 命中 → ActionChainRunner → 动作 → UI
```

## 9. 数据流

```text
上下文 → Jexl 条件 → 布尔 → 动作链 → 属性/状态变化 → UI
```

## 10. 状态变化

- 命中规则后动作链产生的任何状态变化（如 setProp / setVariable）。

## 11. 模块协作

RuleEngine 是「条件 → 动作」的声明式桥：它不关心 UI，只依赖表达式引擎和动作注册表，因此规则可以跨组件、跨数据源组合。

## 12. 扩展点

- 新触发时机：扩展 `RuleTrigger` 与 run 入口。
- 更复杂的依赖：在拓扑排序上增加权重或优先级字段。

## 13. 面试表达

> 组件联动本质是「状态变化 → 条件判断 → 副作用」。我用 RuleEngine 把这条链路声明化：条件用 Jexl、副作用复用动作链，加上防抖和拓扑排序处理重复触发与循环依赖，让联动可配置、可测试、可扩展。
