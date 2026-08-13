# 场景 5：按钮点击 → Action Chain

## 1. 场景

用户点击按钮：先修改按钮文案，再请求数据，请求成功后打开弹窗。

## 2. 最终效果

一次点击依次触发多个动作：文案变化 → 请求 → 弹窗出现。任一动作失败可按 catch / continueOnError 策略处理。

## 3. 完整链路

```text
DOM @click
  → RuntimeRenderer 绑定 onClick
  → RuntimeContext.dispatchNodeEvent
  → EventEngine.execute
  → ActionChainRunner（串行）
  → setProp / request / openDialog 动作
  → Runtime State / Dialog 状态
  → UI 更新
```

## 4. 核心数据结构

```ts
interface EventAction {
  id: string
  kind: 'setProp' | 'setVariable' | 'openDialog' | 'closeDialog' | 'emitEvent' | 'request' | 'navigate' | 'custom'
  config: Record<string, unknown>
  when?: string
  children?: EventAction[]
  catch?: EventAction[]
  continueOnError?: boolean
  delay?: number
}
```

## 5. 核心接口

```ts
interface Action {
  kind: string
  execute(ctx: ActionContext, config, chain): ActionResult | Promise<ActionResult>
}

class ActionChainRunner {
  run(actions: EventAction[]): Promise<ActionResult[]>
}
```

## 6. 工业实现

动作通过 `ActionRegistry` 注册，Core 不写死动作集合。Runner 支持串行、`when` 条件跳过、`children` 条件分支、`catch` 错误处理、`continueOnError`、`delay`、`abort` 中断。异步动作按顺序 await。事件载荷通过 `expressionContext.local.event` 注入表达式作用域。

## 7. 关键代码

```ts
for (const eventAction of actions) {
  if (control.aborted) break
  if (eventAction.when && !ctx.expression.tryEvaluate(eventAction.when, ctx.expressionContext).value) continue
  if (eventAction.children?.length) { results.push(...(await this.run(eventAction.children))); continue }
  const action = this.registry.get(actionKey(eventAction))
  const result = await action.execute(ctx, eventAction.config, control)
  results.push(result)
  if (!result.ok && !eventAction.continueOnError) {
    if (eventAction.catch) results.push(...(await this.run(eventAction.catch)))
    control.abort(result.error)
  }
}
```

## 8. 调用链

```text
click → dispatchNodeEvent → eventEngine.execute → ActionChainRunner.run → action.execute → Runtime State / 副作用
```

## 9. 数据流

```text
EventAction[] → 条件过滤 → 顺序执行 → ActionResult[] → 状态写入 → UI
```

## 10. 状态变化

- `RuntimeContext.state`（requestResult）、`variables`、`dialogs`、节点 props。

## 11. 模块协作

Runtime 只负责把 DOM 事件翻译成 eventName；EventEngine 负责找到动作；ActionRegistry 负责动作实现；ActionContext 通过回调把「写状态 / 开弹窗 / 跳转」等能力注入动作，保持 Core 与 UI 解耦。

## 12. 扩展点

- 新动作：注册到 ActionRegistry（内置或插件），`custom` 类型通过 `config.actionId` 查找。

## 13. 面试表达

> 点击事件在 Runtime 被翻译成 EventAction 链，ActionChainRunner 以可中断的方式串行执行：支持条件、分支、错误捕获和异步等待。动作本身不碰 UI，只通过 ActionContext 回调消费能力，所以新增动作只需注册一个 Action 实现。
