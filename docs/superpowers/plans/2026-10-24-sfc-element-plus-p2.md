# 生成 SFC（纯 Element Plus）P2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐生成页的行为：事件动作全集、动态数据源、schema.rules、生命周期钩子，并恢复 P0 暂跳过的 5 个交互测试。

**Architecture:** 在 generator 的 script 段追加 `overrides/dialogs/requestResult` 状态、`runAction` 与按节点生成的事件处理器；数据源按类型生成 loader；规则用 `runRules(trigger)` 统一调度。

**Tech Stack:** 同 P1。

**Spec:** `docs/superpowers/specs/2026-10-24-sfc-element-plus-design.md`

## Global Constraints

- 生成物仍只依赖 `vue` + `element-plus`（+ Quill/图标按需）；不得 import `@lowcode/*`。
- 动作失败不抛到页面：`try/catch` + `console.warn`，继续后续动作。
- `setProp` 写 `overrides`，模板通过 `v-bind` 消费；`setVariable` 写页面变量 ref。
- 动态数据源只支持 `rest/localStorage/sessionStorage/pageVariable`；`DataModel/API` 仍 warning。
- 每个任务 TDD；最后恢复 `codegen-interaction.test.ts`（去掉 skip）。

---

### Task 1: 事件绑定 + runAction（navigate / emitEvent / setVariable / setProp / dialog / custom）

**Files:**
- Create: `packages/codegen/src/actions.ts`
- Modify: `packages/codegen/src/generator.ts`
- Test: `packages/codegen/src/actions.test.ts`、`generator.test.ts`

**Interfaces:**
- `actions.ts`：
  ```ts
  export function actionHandlerName(nodeId: string, eventName: string): string
  export function buildActionRuntime(options: {
    modelName: string
    variableNames: string[]
    datasourceIds: string[]
  }): string
  export function buildNodeHandlers(schema: PageSchema, ctx): string[]
  ```
- generator：
  - 每个 `node.events` 生成 `@event="on<Event>_<id>"`。
  - script 生成 `overrides/dialogs/requestResult`、`setNodeProp`、`runAction`、事件处理器。
  - 模板 `v-bind="overrides['<id>']"`（组件 + form-item）。

- [ ] **Step 1: 写失败测试**

```ts
it('按钮 click 生成处理器并绑定 @click', async () => {
  const { code } = await generateVueSfc(schemaWith([{
    id: 'b1', name: 'go', type: 'button', props: { label: '去' },
    events: { click: [{ id: 'a1', kind: 'navigate', config: { route: '#/detail' } }] },
  }]))
  expect(code).toContain('@click="onClick_b1"')
  expect(code).toContain('function onClick_b1(payload)')
  expect(code).toContain("location.hash = '#/detail'")
})

it('setVariable / setProp / emitEvent 动作生成对应代码', async () => {
  const schema = schemaWith([{ id: 'b1', name: 'go', type: 'button', props: { label: '去' }, events: {
    click: [
      { id: 'a1', kind: 'setVariable', config: { name: 'count', value: 1 } },
      { id: 'a2', kind: 'setProp', config: { nodeId: 'b1', prop: 'label', value: '已点' } },
      { id: 'a3', kind: 'emitEvent', config: { event: 'refresh' } },
    ],
  } }])
  schema.variables = [{ id: 'v1', name: 'count', value: 0 }]
  const { code } = await generateVueSfc(schema)
  expect(code).toContain('count.value = 1')
  expect(code).toContain("setNodeProp('b1', 'label', '已点')")
  expect(code).toContain('CustomEvent')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- actions`

- [ ] **Step 3: 实现**

- `runAction(action, payload, nodeId)` switch：
  - setProp → `setNodeProp(config.nodeId ?? nodeId, prop, value)`
  - setVariable → `<name>.value = value`
  - openDialog/closeDialog → `dialogs[id]`
  - emitEvent → `window.dispatchEvent(new CustomEvent(name,{detail: payload}))`
  - request → `fetch(url, {method,headers,body})`，结果写 `requestResult`
  - navigate → `location.hash = route`（hash）否则 `location.href`
  - submit/refresh/custom → `console.warn`（Task 4 补 submit/refresh）
- `overrides`/`dialogs`/`requestResult` 状态；`setNodeProp`。
- 事件处理器：`function on<Event>_<id>(payload) { const actions = [...]; for (const action of actions) { if (action.when) { if (!(expr)) continue } try { runAction(action, payload, 'id') } catch ... } }`
- 模板 `v-bind="overrides['id']"` 加在组件与 form-item。
- `action.when` 用脚本模式重写；`config.expression` 先直接支持静态 value。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test`

```bash
git add packages/codegen/src/actions.ts packages/codegen/src/actions.test.ts packages/codegen/src/generator.ts packages/codegen/src/generator.test.ts
git commit -m "feat(codegen): 事件处理与动作运行时"
```

---

### Task 2: 动态数据源（rest / storage / pageVariable）

**Files:**
- Modify: `packages/codegen/src/generator.ts`
- Create: `packages/codegen/src/datasources.ts`
- Test: `packages/codegen/src/datasources.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
it('rest 数据源生成 fetch loader 与 autoLoad', async () => {
  const schema = schemaWith([])
  schema.dataSources = [{ id: 'remote', name: '远程', type: 'rest', config: { url: '/api/list', method: 'POST', params: { page: 1 } }, autoLoad: true }]
  const { code } = await generateVueSfc(schema)
  expect(code).toContain('async function loadRemote()')
  expect(code).toContain("method: 'POST'")
  expect(code).toContain("fetch('/api/list'")
  expect(code).toContain('loadRemote()')
})
it('localStorage 数据源读取 JSON', async () => {
  const schema = schemaWith([])
  schema.dataSources = [{ id: 'local', name: '本地', type: 'localStorage', config: { storageKey: 'k' } }]
  const { code } = await generateVueSfc(schema)
  expect(code).toContain("localStorage.getItem('k')")
})
```

- [ ] **Step 2-4:** 实现 `buildDataSourceRuntime`；`onMounted` 调 autoLoad；`pollInterval` 用 `setInterval`（onBeforeUnmount 清理，导入 `onBeforeUnmount`）；DataModel/API warning。测试→提交。

---

### Task 3: submit / refresh / 表达式辅助函数

- `submit`：调用 `formRef.validate()`，成功派发 `lc-submit` CustomEvent（detail 深拷贝）。
- `refresh`：按 `dataSourceId` 调 `loadX()`。
- `request` 支持 `method/headers/body`。
- script 注入 `count/isEmpty/...` 辅助函数；`buildExpressionHelpers`。
- 测试生成物包含 `validate`、`lc-submit`、`function count`。

---

### Task 4: schema.rules

- 生成 `runRules(trigger)`：遍历 `schema.rules`（enabled），命中 `trigger` 且条件为真时执行动作。
- `mount` 在 onMounted 调；`expression` 在 formData/watch 与数据源加载后调；`event` 在事件处理器末尾调；`datasource` 在 loader 完成后调。
- 条件用脚本模式重写；防抖 `debounceMs` 用 `setTimeout`。
- 测试：mount/expression 条件与动作生成。

---

### Task 5: 节点生命周期 onCreated / onMounted

- 每个节点 `props.onCreated` 在 setup 末尾执行；`onMounted` 在 onMounted 内执行。
- `this` 提供 `value/setValue/getValue`，字段用 formData 的 key；非字段用 `overrides` 或空。
- 测试：生成 `function` 代码 + 编译；恢复 interaction 测试的第 4 项。

---

### Task 6: 恢复 5 个交互测试 + 全量回归

- 去掉 `codegen-interaction.test.ts` 的 `describe.skip`。
- 用新 harness 重写：按钮 click/navigate、无动作按钮、input v-model、onCreated/onMounted。
- 全量 `pnpm -r test`、typecheck、build；文档更新 P2 覆盖。

## P2 完成标准

- 5 个 skipped 测试恢复并通过。
- navigate/emitEvent/setVariable/setProp/request/submit/refresh 生成并可用。
- rest/storage 数据源可用；DataModel/API warning。
- schema.rules 至少 mount/expression 可用。
- 全量绿。
