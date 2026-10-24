# 生成 SFC（纯 Element Plus）P0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 `@lowcode/codegen` 的生成层，让「生成 SFC」输出只依赖 `vue` + `element-plus` 的独立 Vue 3 单文件组件；P0 交付表单壳、校验、10/12 内置模板可生成/编译/挂载。

**Architecture:** Schema → `buildPlan`（表单/字段/告警）→ `MappingRegistry` 逐节点生成 Element Plus 模板 AST → `form/validation/script/style` 分段生成 → Prettier。字段按映射表类型判定，不依赖 editor 注入的 `modelValue`；`$datasource` 保持 runtime 语义（payload 不拆包）。

**Tech Stack:** TypeScript、Vue 3.5、Element Plus 2.14、`@vue/compiler-sfc`、Prettier standalone、Vitest、happy-dom、`@vue/test-utils`。

**Spec:** `docs/superpowers/specs/2026-10-24-sfc-element-plus-design.md`

## Global Constraints

- 生成物只 import `vue`、`element-plus`；用了图标才 import `@element-plus/icons-vue`，用了富文本才 import `@vueup/vue-quill`。生成物中不得出现 `@lowcode/*`。
- 生成物必须是 `<script setup lang="ts">` + `<template>` + `<style scoped>`，并经过 Prettier（`parser: 'vue'`，失败回退原文）。
- 字段判定用 `mapping.field === true`（按类型），不用 `'modelValue' in props`。
- 表单数据键 = `node.name ?? sanitized(node.id)`；`modelName/refName/rulesName` 来自 `settings.form`，默认 `formData/formRef/formRules`。
- `$datasource.x` 是 payload 本身；`.data` 原样保留；模板模式不 `.value`，脚本模式 `.value`。禁止生成 `xState`。
- 未知物料/无法还原能力必须进 `GeneratedCode.warnings`，不能静默丢节点。
- 不改 runtime / materials 行为；只允许在 `normalizePageSchema` 增加两条兼容归一化（`table + columns/data → data-table`、`button.text → label`）。
- 所有代码注释与测试描述用中文，风格对齐现有仓库。
- 每个任务结束必须跑对应测试；P0 结束跑全量 `pnpm -r test`、`pnpm -r typecheck`、`pnpm --filter @lowcode/playground build`。

## Review Focus

- **未经过 editor 的 Schema**（模板 `create()`、手写 JSON、程序化调用）：字段类型节点即使没有 `modelValue`，也必须生成 `el-form-item + v-model`，初始值按类型回落。
- **`$datasource` 成员访问**：`$datasource.userList.data` 必须保留 `.data`，不能变成 `userList`；模板与脚本两种模式都要正确解包。
- **布局表格 vs 数据表格**：`type:'table'` 带 `columns/data` 时不能生成空布局表格；归一化必须命中。
- **按钮 `text` 别名**：不能再被默认 `label:'按钮'` 遮掉；模板、归一化、codegen 三层都要有护栏。
- **生成物依赖边界**：任何内置物料都不得 import `@lowcode/materials`，也不得留下未知组件标签。

---

## 文件结构

```text
packages/codegen/src/
  ast.ts                       （保留）
  generator.ts                 （重写：编排 + SFC 拼装 + Prettier）
  plan.ts                      （新增：buildPlan / root 节点 / 字段 / 告警）
  types.ts                     （新增：GeneratedCode / CodegenWarning / ResolvedForm）
  expressions.ts               （新增：模板/脚本两种重写 + 辅助函数）
  form.ts                      （新增：表单设置 / formData / form-item 属性）
  validation.ts                （新增：rules / 内置校验映射）
  styles.ts                    （新增：排版基线 + 节点 style/class）
  mappings/
    types.ts                   （新增：ElementMapping / MappingContext）
    registry.ts                （新增：MappingRegistry）
    helpers.ts                 （新增：attrs/style/class 小工具）
    test-utils.ts              （新增：映射测试用 context / render）
    containers.ts              （新增：8 个容器）
    basic.ts                   （新增：7 个基础组件）
    fields.ts                  （新增：15 个常用字段）
    index.ts                   （新增：createDefaultRegistry）
  expressions.test.ts
  form.test.ts
  validation.test.ts
  styles.test.ts
  plan.test.ts
  generator.test.ts
  mappings/containers.test.ts
  mappings/basic.test.ts
  mappings/fields.test.ts

packages/schema/src/normalize.ts        （修改：两条兼容归一化）
packages/schema/src/normalize.test.ts   （修改）
packages/editor/src/designer/templates.ts        （修改：data-list / 按钮）
packages/editor/src/designer/templates.test.ts   （修改）
packages/editor/src/integration/generated-harness.ts （新增：编译/挂载工具）
packages/editor/src/integration/generated-runs.test.ts（重写：挂载生成物）
packages/editor/src/integration/templates-codegen.test.ts（新增：10 模板语料）

docs/designer-ui.md                     （P0 末尾更新生成说明）
```

---

### Task 1: Schema 兼容归一化 + 模板修正

**Files:**
- Modify: `packages/schema/src/normalize.ts`
- Modify: `packages/schema/src/normalize.test.ts`
- Modify: `packages/editor/src/designer/templates.ts`
- Modify: `packages/editor/src/designer/templates.test.ts`

**Interfaces:**
- Produces: `normalizePageSchema(input)` 在返回前应用内部函数 `applyNodeCompat(schema: PageSchema): PageSchema`；不新增导出。

- [ ] **Step 1: 写失败测试（schema）**

在 `normalize.test.ts` 增加：

```ts
it('table 带 columns/data 时归一化为 data-table', () => {
  const schema = normalizePageSchema(legacyWithNodes([
    { id: 't1', type: 'table', props: { columns: [{ prop: 'name', label: '姓名' }], data: [] } },
    { id: 't2', type: 'table', props: { border: true }, children: [] },
  ]))
  expect(schema.nodes[0].type).toBe('data-table')
  expect(schema.nodes[1].type).toBe('table')
})

it('button 只有 text 时补成 label', () => {
  const schema = normalizePageSchema(legacyWithNodes([
    { id: 'b1', type: 'button', props: { text: '登录' } },
    { id: 'b2', type: 'button', props: { label: '提交', text: '旧文案' } },
  ]))
  expect(schema.nodes[0].props.label).toBe('登录')
  expect(schema.nodes[0].props.text).toBe('登录')
  expect(schema.nodes[1].props.label).toBe('提交')
})
```

`legacyWithNodes` 是测试内工具，构造一个最小合法 `PageSchema`。

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/schema test -- normalize`
Expected: FAIL（type 仍为 `table` / `label` 为 `undefined`）。

- [ ] **Step 3: 实现 `applyNodeCompat`**

在 `normalize.ts` 增加内部函数，并在 `normalizePageSchema` 的两个 return 路径（旧版输入、统一结构转换）都套用：

```ts
function applyNodeCompat(schema: PageSchema): PageSchema {
  for (const node of schema.nodes) {
    if (
      node.type === 'table' &&
      (node.props?.columns !== undefined || node.props?.data !== undefined)
    ) {
      node.type = 'data-table'
    }
    if (
      node.type === 'button' &&
      (node.props?.label === undefined || node.props?.label === '') &&
      node.props?.text !== undefined
    ) {
      node.props.label = node.props.text
    }
  }
  return schema
}
```

保留 `props.text`（组件仍兜底），不删除。

- [ ] **Step 4: 运行 schema 测试**

Run: `pnpm --filter @lowcode/schema test -- normalize`
Expected: PASS。

- [ ] **Step 5: 修模板（失败测试先行）**

在 `templates.test.ts` 增加：

```ts
it('数据列表页用 data-table，按钮用 label', () => {
  const schema = templateRegistry.get('list')!.create() as PageSchema
  expect(schema.nodes.find((n) => n.props.columns)?.type).toBe('data-table')
  const buttons = schema.nodes.filter((n) => n.type === 'button')
  expect(buttons.every((n) => typeof n.props.label === 'string')).toBe(true)
  expect(buttons.every((n) => n.props.text === undefined)).toBe(true)
})
```

Run: `pnpm --filter @lowcode/editor test -- templates`
Expected: FAIL。

- [ ] **Step 6: 修改 `templates.ts`**

- 「数据列表页」`tpl_list_table.type: 'table'` → `'data-table'`；
- 登录按钮 `props: { text: '登录', ... }` → `{ label: '登录', ... }`；
- 数据列表刷新按钮 `text` → `label`。

- [ ] **Step 7: 运行测试并提交**

Run: `pnpm --filter @lowcode/schema test -- normalize && pnpm --filter @lowcode/editor test -- templates`
Expected: PASS。

```bash
git add packages/schema/src/normalize.ts packages/schema/src/normalize.test.ts packages/editor/src/designer/templates.ts packages/editor/src/designer/templates.test.ts
git commit -m "fix(schema): 归一化 data-table 与按钮 label 兼容"
```

---

### Task 2: 映射注册表 + buildPlan + warnings

**Files:**
- Create: `packages/codegen/src/types.ts`
- Create: `packages/codegen/src/mappings/types.ts`
- Create: `packages/codegen/src/mappings/registry.ts`
- Create: `packages/codegen/src/plan.ts`
- Test: `packages/codegen/src/plan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export interface CodegenWarning { code: string; message: string; nodeId?: string }
  export interface ResolvedForm {
    modelName: string
    refName: string
    rulesName: string
    labelPosition: 'left' | 'top'
    labelAlign: 'left' | 'center' | 'right'
    labelWidth: number
    size: 'large' | 'default' | 'small'
    customClass: string[]
    cssCode: string
    functions: string
  }
  export interface GeneratedCode {
    filename: string
    code: string
    template: string
    script: string
    style: string
    warnings: CodegenWarning[]
  }

  // mappings/types.ts
  export interface MappingContext {
    schema: PageSchema
    nodes: Map<string, PageNode>
    datasourceIds: string[]
    variableNames: string[]
    form: ResolvedForm
    mode: 'template' | 'script'
    warnings: CodegenWarning[]
    warn(code: string, message: string, nodeId?: string): void
    modelKey(node: PageNode): string
    prop(node: PageNode, name: string): unknown
    renderNode(node: PageNode): TemplateNode
    renderChildren(node: PageNode): TemplateNode[]
  }
  export interface ElementMapping {
    tag: string
    field?: boolean
    imports?: Array<{ name: string; from: string }>
    attrs: (node: PageNode, ctx: MappingContext) => Record<string, string>
    render?: (node: PageNode, ctx: MappingContext) => TemplateNode
    initialValue?: (node: PageNode) => unknown
    setup?: (node: PageNode, ctx: MappingContext) => string[]
    rules?: (node: PageNode, ctx: MappingContext) => string[]
  }
  export interface MappingRegistry {
    register(type: string, mapping: ElementMapping): void
    get(type: string): ElementMapping | undefined
    registerComponent(type: string, entry: { tag: string; importName: string; from: string }): void
    component(type: string): { tag: string; importName: string; from: string } | undefined
  }
  export function createMappingRegistry(): MappingRegistry

  // plan.ts
  export interface CodegenPlan {
    schema: PageSchema
    rootNodes: PageNode[]
    fieldNodes: PageNode[]
    modelKeys: Map<string, string>
    warnings: CodegenWarning[]
  }
  export function buildPlan(schema: PageSchema, registry: MappingRegistry): CodegenPlan
  export function sanitizeIdentifier(raw: string, fallback: string): string
  ```

- [ ] **Step 1: 写失败测试**

`plan.test.ts`：

```ts
it('按 mapping.field 判定字段，不依赖 modelValue', () => {
  const registry = createMappingRegistry()
  registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}) })
  const plan = buildPlan(schemaWith([
    { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名' } },
    { id: 'b1', name: 'btn', type: 'button', props: { label: '提交' } },
  ]), registry)
  expect(plan.fieldNodes.map((n) => n.id)).toEqual(['f1'])
  expect(plan.modelKeys.get('f1')).toBe('userName')
})

it('根节点排除 children 与 slots 引用', () => {
  const registry = createMappingRegistry()
  registry.register('card', { tag: 'el-card', attrs: () => ({}), field: false })
  const plan = buildPlan(schemaWith([
    { id: 'a', type: 'card', props: {}, children: ['b'], slots: { extra: ['c'] } },
    { id: 'b', type: 'text', props: {} },
    { id: 'c', type: 'text', props: {} },
  ]), registry)
  expect(plan.rootNodes.map((n) => n.id)).toEqual(['a'])
})

it('未知物料产生 warning，不抛错', () => {
  const plan = buildPlan(schemaWith([{ id: 'x', type: 'nope', props: {} }]), createMappingRegistry())
  expect(plan.warnings[0]).toMatchObject({ code: 'unknown-material', nodeId: 'x' })
})

it('模型键保留合法 name，非法/重复时回退 id 并 warning', () => {
  const registry = createMappingRegistry()
  registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}) })
  const plan = buildPlan(schemaWith([
    { id: 'f1', name: 'user name', type: 'input', props: {} },
    { id: 'f2', name: 'dup', type: 'input', props: {} },
    { id: 'f3', name: 'dup', type: 'input', props: {} },
  ]), registry)
  expect(plan.modelKeys.get('f1')).toBe('user_name')
  expect(plan.modelKeys.get('f3')).toBe('f3')
  expect(plan.warnings.some((w) => w.code === 'model-key')).toBe(true)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- plan`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

- `createMappingRegistry` 用 `Map`；`registerComponent` 存逃生口；`get` 只返回 `ElementMapping`。
- `buildPlan` 遍历 `schema.nodes`，`fieldNodes` = `registry.get(node.type)?.field === true`。
- 引用集合来自所有 `children` + `slots` 值；root 为未引用节点，保持原顺序。
- `modelKeys`：`sanitizeIdentifier(node.name || node.id)`；重复时后者回退 `sanitizeIdentifier(node.id)` 并 warning `model-key`。
- 未知 type warning `unknown-material`（message 含 `未注册物料: <type>`）。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- plan`
Expected: PASS。

```bash
git add packages/codegen/src/types.ts packages/codegen/src/mappings packages/codegen/src/plan.ts packages/codegen/src/plan.test.ts
git commit -m "feat(codegen): 映射注册表与生成计划"
```

---

### Task 3: 表达式重写（模板 / 脚本两种模式）

**Files:**
- Create: `packages/codegen/src/expressions.ts`
- Test: `packages/codegen/src/expressions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ExpressionMode = 'template' | 'script'
  export function rewriteExpression(
    expr: string,
    datasourceIds: string[],
    variableNames: string[],
    mode?: ExpressionMode,
  ): string
  export const EXPRESSION_HELPER_NAMES: readonly string[]
  export function buildExpressionHelpers(): string
  ```

- [ ] **Step 1: 写失败测试**

```ts
it('$datasource 保留 .data，模板模式不 .value', () => {
  expect(rewriteExpression('count($datasource.userList.data)', ['userList'], [], 'template'))
    .toBe('count(userList?.data)')
  expect(rewriteExpression('$datasource.userList.length > 0', ['userList'], [], 'template'))
    .toBe('userList?.length > 0')
})

it('脚本模式补 .value', () => {
  expect(rewriteExpression('count($datasource.userList.data)', ['userList'], [], 'script'))
    .toBe('count(userList.value?.data)')
  expect(rewriteExpression('$page.status', [], ['status'], 'script')).toBe('status.value')
})

it('$datasource 单独引用不产生可选链 / xState', () => {
  expect(rewriteExpression('$datasource.userList', ['userList'], [], 'template')).toBe('userList')
  expect(rewriteExpression('$datasource.userList', ['userList'], [], 'script')).toBe('userList.value')
})

it('长 id 优先，避免 users 污染 users2', () => {
  const ids = ['users', 'users2']
  expect(rewriteExpression('$datasource.users2.data + $datasource.users.data', ids, [], 'template'))
    .toBe('users2?.data + users?.data')
})

it('生成 core 同名辅助函数', () => {
  const code = buildExpressionHelpers()
  for (const name of ['count', 'isEmpty', 'contains', 'toUpper', 'toLower', 'round', 'floor', 'ceil', 'join']) {
    expect(code).toContain(`function ${name}`)
  }
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- expressions`
Expected: FAIL。

- [ ] **Step 3: 实现**

- token 边界 `(?![\w$])`，按 id 长度降序替换。
- 模板：`$datasource.<id>` → `<id>`；若后面紧跟 `.`，替换为 `<id>?.`；脚本：`<id>.value` / `<id>.value?.`。
- `$page.<name>` → `<name>` / `<name>.value`。
- `buildExpressionHelpers()` 返回 core 对齐的 9 个函数源码（纯 JS，模板与脚本共用）。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- expressions`
Expected: PASS。

```bash
git add packages/codegen/src/expressions.ts packages/codegen/src/expressions.test.ts
git commit -m "feat(codegen): 模板/脚本双模式表达式重写"
```

---

### Task 4: 表单设置 + formData + form-item 包装

**Files:**
- Create: `packages/codegen/src/form.ts`
- Test: `packages/codegen/src/form.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function resolveForm(schema: PageSchema): ResolvedForm
  export function buildFormData(plan: CodegenPlan, registry: MappingRegistry): string
  export function buildFormItemAttrs(node: PageNode, ctx: MappingContext): Record<string, string>
  export function buildFormAttrs(form: ResolvedForm, hasFields: boolean): Record<string, string>
  ```

- [ ] **Step 1: 写失败测试**

```ts
it('表单设置缺省与自定义名字', () => {
  expect(resolveForm(schemaWith([]))).toMatchObject({
    modelName: 'formData', refName: 'formRef', rulesName: 'formRules',
    labelPosition: 'left', labelWidth: 80, size: 'default',
  })
  const form = resolveForm(schemaWith([], { form: { modelName: 'form model', refName: 'r', labelWidth: 150, labelPosition: 'top' } }))
  expect(form.modelName).toBe('form_model')
  expect(form.labelPosition).toBe('top')
  expect(form.labelWidth).toBe(150)
})

it('原始 schema 没有 modelValue 也生成字段初始值', () => {
  const registry = createMappingRegistry()
  registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}), initialValue: () => '' })
  registry.register('checkbox', { tag: 'el-checkbox-group', field: true, attrs: () => ({}), initialValue: () => [] })
  registry.register('switch', { tag: 'el-switch', field: true, attrs: () => ({}), initialValue: () => false })
  const plan = buildPlan(schemaWith([
    { id: 'i1', name: 'name', type: 'input', props: {} },
    { id: 'c1', name: 'tags', type: 'checkbox', props: {} },
    { id: 's1', name: 'enabled', type: 'switch', props: {} },
  ]), registry)
  const data = buildFormData(plan, registry)
  expect(data).toContain('name: ""')
  expect(data).toContain('tags: []')
  expect(data).toContain('enabled: false')
})

it('labelHidden / labelWidth / labelAlign 落到 form-item', () => {
  const ctx = makeContext()
  expect(buildFormItemAttrs({ id: 'f', type: 'input', props: { labelHidden: true } }, ctx)).toMatchObject({
    'label-width': '0',
  })
  expect(buildFormItemAttrs({ id: 'f', type: 'input', props: { labelWidth: 120, labelAlign: 'right' } }, ctx))
    .toMatchObject({ 'label-width': '120px', class: 'lc-label-right' })
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- form`
Expected: FAIL。

- [ ] **Step 3: 实现**

- `resolveForm` 用 `getFormSettings(schema.settings)`，三个名字走 `sanitizeIdentifier`。
- `buildFormData` 只遍历 `plan.fieldNodes`；初始值 = `'modelValue' in node.props ? node.props.modelValue : mapping.initialValue?.(node) ?? null`；键用 `plan.modelKeys`。
- `buildFormAttrs`：`ref/model/rules`、`label-position`、`label-width`（`${n}px`）、`size`、`class`（form customClass）。
- `buildFormItemAttrs`：`label`（`labelHidden` 时不返回）、`prop`、`label-width`（逐字段覆盖或 `labelHidden` 时 `0`）、`class`（`lc-label-${labelAlign}`）。
- 标签图标/提示留到 P1。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- form`
Expected: PASS。

```bash
git add packages/codegen/src/form.ts packages/codegen/src/form.test.ts
git commit -m "feat(codegen): 表单设置与 formData 生成"
```

---

### Task 5: 校验规则

**Files:**
- Create: `packages/codegen/src/validation.ts`
- Test: `packages/codegen/src/validation.test.ts`
- Modify: `packages/codegen/package.json`（新增 devDependency `@lowcode/core`，仅用于一致性对表）

**Interfaces:**
- Produces:
  ```ts
  export const BUILTIN_VALIDATION_PATTERNS: Record<string, string>
  export const BUILTIN_VALIDATION_MESSAGES: Record<string, (label: string) => string>
  export function buildRulesForField(node: PageNode, ctx: MappingContext): string[]
  export function buildRulesObject(plan: CodegenPlan, ctx: MappingContext): string
  ```

- [ ] **Step 1: 写失败测试**

```ts
it('required 生成必填规则与自定义文案', () => {
  const rules = buildRulesForField(node({ type: 'input', props: { required: true } }), ctx)
  expect(rules.join('\n')).toContain('required: true')
  expect(rules.join('\n')).toContain('字段值不可为空')
  expect(rules.join('\n')).toContain("trigger: ['blur', 'change']")
})

it('内置 email 生成 pattern 与默认文案', () => {
  const rules = buildRulesForField(node({ type: 'input', props: { validation: 'email', label: '邮箱' } }), ctx)
  expect(rules.join('\n')).toContain('pattern: /^([-_A-Za-z0-9.]+)@')
  expect(rules.join('\n')).toContain('[邮箱]邮箱格式有误')
})

it('自定义正则在非法时 warning 并跳过', () => {
  const ctx = makeContext()
  const rules = buildRulesForField(node({ type: 'input', props: { validation: '[' } }), ctx)
  expect(rules).toEqual([])
  expect(ctx.warnings.some((w) => w.code === 'invalid-pattern')).toBe(true)
})

it('onValidate 生成自定义 validator', () => {
  const rules = buildRulesForField(node({
    type: 'input',
    props: { onValidate: 'if (!value) callback(new Error("必填"))' },
  }), ctx)
  expect(rules.join('\n')).toContain('validator: (rule, value, callback)')
  expect(rules.join('\n')).toContain('new Error("必填")')
})

it('内置校验表与 core 一致', async () => {
  const core = await import('@lowcode/core')
  expect(BUILTIN_VALIDATION_PATTERNS).toEqual(core.BUILTIN_PATTERNS)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- validation`
Expected: FAIL。

- [ ] **Step 3: 实现**

- 复制 core 的 9 个正则与文案函数；`validation` 命中内置名用内置正则/文案，否则 `new RegExp`（try/catch，失败 warning `invalid-pattern`）。
- `minLength/maxLength` → `{ min, max, message }`（对字符串/数组）。
- `onValidate` → `{ validator: (rule, value, callback) => { try { ...用户代码... } catch (e) { callback(e) } } }`；用户代码里的 `callback` 直接可用。
- `buildRulesObject` 生成 `const ${rulesName} = { key: [ ... ] }`，没有规则的字段不写。
- 测试里的 `ctx` / `makeContext()` 用本地 helper：`warnings` 数组 + `warn` 推入。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm install && pnpm --filter @lowcode/codegen test -- validation`
Expected: PASS。

```bash
git add packages/codegen/src/validation.ts packages/codegen/src/validation.test.ts packages/codegen/package.json pnpm-lock.yaml
git commit -m "feat(codegen): Element Plus 校验规则生成"
```

---

### Task 6: 样式基线 + 节点 style/class

**Files:**
- Create: `packages/codegen/src/styles.ts`
- Test: `packages/codegen/src/styles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const BASE_STYLE: string
  export function buildNodeStyle(node: PageNode, ctx: MappingContext): string | undefined
  export function buildNodeClass(node: PageNode, mappingClass?: string): string | undefined
  export function buildStyleBlock(plan: CodegenPlan): { scoped: string; global: string }
  ```

- [ ] **Step 1: 写失败测试**

```ts
it('kebab-case 键与字符串值都用 JSON 转义', () => {
  const style = buildNodeStyle(node({ style: {
    'border-radius': { type: 'static', value: '8px' },
    fontFamily: { type: 'static', value: "O'Reilly" },
  } }), ctx)
  expect(style).toContain('"border-radius"')
  expect(style).toContain('"8px"')
  expect(style).toContain('"O\'Reilly"')
})

it('表达式样式按模板模式重写', () => {
  const style = buildNodeStyle(node({ style: { color: { type: 'expression', value: '$page.color' } } }), ctx)
  expect(style).toContain('color: color')
})

it('class 来自 node.props.class，与 mapping class 合并', () => {
  expect(buildNodeClass(node({ props: { class: ['a', 'b'] } }), 'lc-button')).toBe('lc-button a b')
})

it('样式块含表单/按钮/卡片/栅格基线', () => {
  const { scoped, global } = buildStyleBlock(plan)
  expect(scoped).toContain('.el-form-item')
  expect(scoped).toContain('.el-button')
  expect(scoped).toContain('.el-card')
  expect(scoped).toContain('.el-row')
  expect(global).toContain('.lc-page')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- styles`
Expected: FAIL。

- [ ] **Step 3: 实现**

- 从 materials 的 FormItem/Button/Card/Grid/LayoutTable/Tab 抽取排版基线，写进 `BASE_STYLE`（值必须与 spec §6 一致）。
- `buildNodeStyle`：表达式值用 `rewriteExpression(..., 'template')`；静态字符串/键用 `JSON.stringify`。
- `buildNodeClass`：`props.class` 是字符串数组；与 mapping class 合并去重。
- `buildStyleBlock`：scoped = BASE_STYLE；global = `settings.form.cssCode`（空则不生成）。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- styles`
Expected: PASS。

```bash
git add packages/codegen/src/styles.ts packages/codegen/src/styles.test.ts
git commit -m "feat(codegen): 排版基线与节点样式生成"
```

---

### Task 7: 容器映射 A（card / grid / grid-col / tab / tab-pane）

**Files:**
- Create: `packages/codegen/src/mappings/helpers.ts`
- Create: `packages/codegen/src/mappings/test-utils.ts`
- Create: `packages/codegen/src/mappings/containers.ts`
- Create: `packages/codegen/src/mappings/index.ts`
- Test: `packages/codegen/src/mappings/containers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // helpers.ts
  export function staticAttr(name: string, value: unknown): Record<string, string>
  export function bindAttr(name: string, value: string): Record<string, string>
  export function boolAttr(name: string, value: unknown): Record<string, string>
  export function renderChildren(node: PageNode, ctx: MappingContext): TemplateNode[]

  // containers.ts
  export function registerContainerMappings(registry: MappingRegistry): void

  // index.ts（后续任务继续往里注册）
  export function createDefaultRegistry(): MappingRegistry

  // test-utils.ts（仅测试用）
  export function makeMappingContext(overrides?: Partial<MappingContext>): MappingContext
  export function renderNodeToTemplate(node: PageNode, registry: MappingRegistry): string
  ```

`createDefaultRegistry()` 本任务只注册容器；Task 9 加基础组件，Task 11/12 加字段。

- [ ] **Step 1: 写失败测试**

```ts
it('card 生成 el-card + header 插槽 + 折叠状态', () => {
  const out = renderNodeToTemplate(node({ type: 'card', props: { label: '分组', showCollapse: true }, children: ['t'] }), registry)
  expect(out).toContain('<el-card')
  expect(out).toContain('分组')
  expect(out).toContain('template #header')
  expect(out).toContain('cardCollapsed_')
})

it('grid 生成 el-row，grid-col 响应式走 md/sm/xs', () => {
  expect(renderNodeToTemplate(node({ type: 'grid', props: { gutter: 12 } }), registry)).toContain('<el-row')
  const col = renderNodeToTemplate(node({ type: 'grid-col', props: { responsive: true, md: 8, sm: 12, xs: 24 } }), registry)
  expect(col).toContain(':md="8"')
  expect(col).toContain(':sm="12"')
  expect(col).toContain(':xs="24"')
  expect(col).not.toContain(':span=')
})

it('tab 生成 el-tabs + v-model，pane 带 label/name/disabled', () => {
  const out = renderNodeToTemplate(tabNode(), registry)
  expect(out).toContain('<el-tabs')
  expect(out).toContain('v-model=')
  expect(out).toContain('<el-tab-pane')
  expect(out).toContain('label="第一页"')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- containers`
Expected: FAIL。

- [ ] **Step 3: 实现 helpers + test-utils + 5 个映射**

- `test-utils` 构造最小 `MappingContext`（`form` 用默认值、`warn` 推 warnings、`renderNode` 递归），`renderNodeToTemplate` 用 `stringifyTemplate`。
- `index.ts` 的 `createDefaultRegistry` = `createMappingRegistry()` + `registerContainerMappings`。
- card：`el-card`，`#header` 插槽显示 label；`showCollapse` 时按钮切换 `cardCollapsed_<id>`（`setup` 生成 `const cardCollapsed_x = ref(false)`）；children → default。
- grid：`el-row`，`gutter/justify`，`:style` 写 `--lc-grid-col-height`。
- grid-col：`el-col`，响应式三元；`offset/push/pull` 仅非零才输出。
- tab：`el-tabs` + mapping 自有 `v-model="tabActive_x"`（`setup` 初始化 `activeName || 第一个 pane 的 name/label`）；children → default。
- tab-pane：`el-tab-pane`，label/name/disabled；`active === true` 时 setup 把父 tab 初始值设为它。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- containers`
Expected: PASS。

```bash
git add packages/codegen/src/mappings/helpers.ts packages/codegen/src/mappings/test-utils.ts packages/codegen/src/mappings/containers.ts packages/codegen/src/mappings/index.ts packages/codegen/src/mappings/containers.test.ts
git commit -m "feat(codegen): 卡片/栅格/标签页容器映射"
```

---

### Task 8: 布局表格映射（table / table-row / table-cell）

**Files:**
- Modify: `packages/codegen/src/mappings/containers.ts`
- Test: `packages/codegen/src/mappings/containers.test.ts`

**Interfaces:**
- Produces: `table` / `table-row` / `table-cell` 三个 `ElementMapping`。

- [ ] **Step 1: 写失败测试**

```ts
it('布局表格生成 table > tbody > tr > td', () => {
  const out = renderNodeToTemplate(tableNode(), registry)
  expect(out).toMatch(/<div class="lc-layout-table[^"]*">\s*<table>/)
  expect(out).toContain('<tbody>')
  expect(out).toContain('<tr>')
  expect(out).toContain('<td')
})

it('表格单元格带 colspan/rowspan 与宽高', () => {
  const out = renderNodeToTemplate(node({ type: 'table-cell', props: { colspan: 2, rowspan: 3, cellWidth: '120px' } }), registry)
  expect(out).toContain('colspan="2"')
  expect(out).toContain('rowspan="3"')
  expect(out).toContain('width: 120px')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- containers`
Expected: FAIL。

- [ ] **Step 3: 实现**

- `table`：`div.lc-layout-table`（`border` → `lc-layout-table--border`）→ `table` → `tbody`；children 只渲染 table-row。
- `table-row`：`tr`；children 只渲染 table-cell。
- `table-cell`：`td`，`colspan/rowspan`（>1 才输出）、宽高 style、`word-break: break-word`。
- 三类都不包 form-item。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- containers`
Expected: PASS。

```bash
git add packages/codegen/src/mappings/containers.ts packages/codegen/src/mappings/containers.test.ts
git commit -m "feat(codegen): 布局表格映射"
```

---

### Task 9: 基础组件映射（text / static-text / html-text / button / divider / image / alert）

**Files:**
- Create: `packages/codegen/src/mappings/basic.ts`
- Modify: `packages/codegen/src/mappings/index.ts`
- Test: `packages/codegen/src/mappings/basic.test.ts`

**Interfaces:**
- Produces: `registerBasicMappings(registry: MappingRegistry): void`

测试初始化：`const registry = createDefaultRegistry(); registerBasicMappings(registry)`。

- [ ] **Step 1: 写失败测试**

```ts
it('static-text 输出文本与排版样式', () => {
  const out = renderNodeToTemplate(node({ type: 'static-text', props: { textContent: '标题', fontSize: '20px', textAlign: 'center' } }), registry)
  expect(out).toContain('标题')
  expect(out).toContain('font-size: 20px')
})

it('html-text 用 v-html', () => {
  expect(renderNodeToTemplate(node({ type: 'html-text', props: { htmlContent: '<b>x</b>' } }), registry)).toContain('v-html=')
})

it('button 支持 label 与 text 兜底', () => {
  expect(renderNodeToTemplate(node({ type: 'button', props: { label: '提交' } }), registry)).toContain('提交')
  expect(renderNodeToTemplate(node({ type: 'button', props: { text: '旧按钮' } }), registry)).toContain('旧按钮')
})

it('divider 的 label 走默认插槽', () => {
  const out = renderNodeToTemplate(node({ type: 'divider', props: { label: '分组' } }), registry)
  expect(out).toContain('<el-divider')
  expect(out).toContain('分组')
})

it('alert 映射到 el-alert', () => {
  expect(renderNodeToTemplate(node({ type: 'alert', props: { title: '提示' } }), registry)).toContain('<el-alert')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- basic`
Expected: FAIL。

- [ ] **Step 3: 实现 7 个映射**

- 在 `mappings/index.ts` 的 `createDefaultRegistry` 里追加 `registerBasicMappings(registry)`。
- text：`div.lc-text`，`text/color/fontSize/bold/align` → style。
- static-text：`div.lc-static-text`，textContent/textAlign/fontSize/preWrap/columnWidth。
- html-text：`div.lc-html-text` + `v-html`。
- button：`el-button`，`label ?? text ?? '按钮'`；type/size/plain/round/circle/disabled；`displayStyle` → style；有 events 时 warning `events-deferred`（P0 不生成动作）。
- divider：`el-divider`，direction/contentPosition；label → default 插槽。
- image：`el-image`，src/alt/width/height。
- alert：`el-alert`，title/type/description/closable/closeText/center/showIcon/effect。
- 图标属性 P0 丢弃并 warning `icon-deferred`。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- basic`
Expected: PASS。

```bash
git add packages/codegen/src/mappings/basic.ts packages/codegen/src/mappings/basic.test.ts
git commit -m "feat(codegen): 基础组件 Element Plus 映射"
```

---

### Task 10: 生成器编排 + 导入收集 + SFC 拼装

**Files:**
- Modify: `packages/codegen/src/mappings/index.ts`（Task 7 创建；Task 9 已加基础组件）
- Rewrite: `packages/codegen/src/generator.ts`
- Modify: `packages/codegen/src/index.ts`
- Delete: `packages/codegen/src/codegen.test.ts`（用例迁移到 `generator.test.ts`）
- Test: `packages/codegen/src/generator.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CodegenMaterialMapEntry { importName: string; from: string }
  export type CodegenMaterialMap = Record<string, CodegenMaterialMapEntry>
  export class VueSfcGenerator {
    constructor(options?: { materials?: CodegenMaterialMap; registry?: MappingRegistry })
    generate(schema: PageSchema): Promise<GeneratedCode>
  }
  export function generateVueSfc(
    schema: PageSchema,
    options?: { materials?: CodegenMaterialMap; registry?: MappingRegistry },
  ): Promise<GeneratedCode>
  export function createDefaultRegistry(): MappingRegistry
  ```

- [ ] **Step 1: 写失败测试**

```ts
it('生成只含 vue + element-plus 的 SFC', async () => {
  const { code, warnings } = await generateVueSfc(schemaWith([buttonNode(), staticTextNode()]))
  expect(code).toContain('<script setup lang="ts">')
  expect(code).toContain("from 'vue'")
  expect(code).toContain("from 'element-plus'")
  expect(code).not.toContain('@lowcode/')
  expect(code).not.toContain('未注册物料')
  expect(warnings.filter((w) => w.code === 'unknown-material')).toEqual([])
})

it('只 import 用到的 Element Plus 组件', async () => {
  const { code } = await generateVueSfc(schemaWith([inputStub()])) // 通过 registry 注入 stub
  expect(code).toContain('ElInput')
  expect(code).not.toContain('ElTable')
})

it('字段节点自动包 el-form-item 并加 v-model', async () => {
  const registry = createDefaultRegistry()
  registry.register('input', { tag: 'el-input', field: true, attrs: () => ({}), initialValue: () => '' })
  const { code } = await new VueSfcGenerator({ registry }).generate(schemaWith([
    { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名' } },
  ]))
  expect(code).toContain('<el-form-item')
  expect(code).toContain('prop="userName"')
  expect(code).toContain('v-model="formData.userName"')
  expect(code).toContain('<el-form')
})

it('未知物料进 warnings 且模板里有注释', async () => {
  const { code, warnings } = await generateVueSfc(schemaWith([{ id: 'x', type: 'nope', props: {} }]))
  expect(code).toContain('未注册物料: nope')
  expect(warnings[0].code).toBe('unknown-material')
})

it('自定义组件映射仍可用（逃生口）', async () => {
  const { code } = await generateVueSfc(schemaWith([{ id: 'c', type: 'my-card', props: {} }]), {
    materials: { 'my-card': { importName: 'MyCard', from: '@my-pkg/cards' } },
  })
  expect(code).toContain("import { MyCard } from '@my-pkg/cards'")
  expect(code).toContain('<MyCard')
})

it('生成的代码可被 @vue/compiler-sfc 解析', async () => {
  const { code } = await generateVueSfc(schemaWith([buttonNode(), staticTextNode()]))
  const { errors } = parse(code, { filename: 'page.vue' })
  expect(errors).toHaveLength(0)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- generator`
Expected: FAIL。

- [ ] **Step 3: 实现**

- `createDefaultRegistry()` 注册 containers + basic（fields 在 Task 11/12 加入）。
- generator：`buildPlan` → `MappingContext` → root 模板（有字段时 `<el-form>` + attrs，否则 `<div class="lc-page">`）→ 每个 root `renderNode`；字段节点自动包 `<el-form-item>` 并加 `v-model`。
- 通用属性：每个节点由 generator 统一合并 `:style`（`buildNodeStyle`）与 `class`（`buildNodeClass`）；字段节点合并到 `el-form-item`，非字段合并到标签本身；`v-if`/`v-for` 留到 P1。
- 组件导入：从 AST 收集 `el-*` 标签 → `El*`；自定义 component 映射 → 对应导入；不含未使用组件。
- 脚本：按需 `import { reactive, ref }`、`buildFormData`、`buildRulesObject`、mapping `setup()`。
- 样式：`buildStyleBlock`。
- 拼装后 `formatWithPrettier`；失败回退原文；`warnings` 从 plan/mapping 收集。
- `rewriteExpression` 继续从 `index.ts` 导出（外部测试依赖）。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test`
Expected: PASS（旧 `codegen.test.ts` 中仍有价值的用例迁移后删除）。

```bash
git add packages/codegen/src/generator.ts packages/codegen/src/mappings/index.ts packages/codegen/src/index.ts packages/codegen/src/generator.test.ts
git rm packages/codegen/src/codegen.test.ts
git commit -m "feat(codegen): 纯 Element Plus SFC 生成器"
```

---

### Task 11: 字段映射 A（input / textarea / number / radio / checkbox / select / switch）

**Files:**
- Create: `packages/codegen/src/mappings/fields.ts`
- Modify: `packages/codegen/src/mappings/index.ts`
- Test: `packages/codegen/src/mappings/fields.test.ts`

**Interfaces:**
- Produces: `registerFieldMappings(registry: MappingRegistry): void`（本任务先注册 7 个，Task 12 补齐）

- [ ] **Step 1: 写失败测试**

```ts
it('input 包 form-item、v-model 指向 formData.name', async () => {
  const { code } = await generateVueSfc(schemaWith([
    { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', placeholder: '请输入' } },
  ]))
  expect(code).toContain('<el-form-item')
  expect(code).toContain('label="姓名"')
  expect(code).toContain('prop="userName"')
  expect(code).toContain('v-model="formData.userName"')
  expect(code).toContain('<el-input')
  expect(code).toContain('placeholder="请输入"')
})

it('radio/checkbox/select 渲染 optionItems 子节点', async () => {
  const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]
  expect((await generateVueSfc(schemaWith([fieldNode('radio', { optionItems: options })]))).code).toContain('<el-radio')
  expect((await generateVueSfc(schemaWith([fieldNode('radio', { optionItems: options, buttonStyle: true })]))).code).toContain('<el-radio-button')
  expect((await generateVueSfc(schemaWith([fieldNode('checkbox', { optionItems: options })]))).code).toContain('<el-checkbox')
  expect((await generateVueSfc(schemaWith([fieldNode('select', { optionItems: options })]))).code).toContain('<el-option')
})

it('switch 映射文案/颜色/宽度', async () => {
  const { code } = await generateVueSfc(schemaWith([
    fieldNode('switch', { activeText: '开', inactiveText: '关', switchWidth: 60 }),
  ]))
  expect(code).toContain('active-text="开"')
  expect(code).toContain(':width="60"')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- fields`
Expected: FAIL。

- [ ] **Step 3: 实现 7 个映射**

- 所有字段：`field: true`；`v-model` 统一由 generator 添加，mapping 的 `attrs` 不写。
- 每个字段同时提供 `initialValue`：input/textarea/radio/select(单选) → `''`，number → `null`，checkbox/select(多选) → `[]`，switch → `false`。
- input：type（number→text，与物料一致）、placeholder、clearable、disabled、readonly、showPassword、size、minlength/maxlength、showWordLimit、prefix/suffix；`appendButton` → `#append` 插槽。
- textarea：`el-input type="textarea"` + rows。
- number：`el-input-number` + min/max/precision/step/controlsPosition。
- radio：`el-radio-group`，optionItems → `el-radio` / `el-radio-button`（buttonStyle），border/displayStyle。
- checkbox：`el-checkbox-group`，同上。
- select：`el-select` + `el-option`，multiple/multipleLimit/filterable/allowCreate/remote/clearable/placeholder。
- switch：active/inactive text/color、width。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- fields`
Expected: PASS。

```bash
git add packages/codegen/src/mappings/fields.ts packages/codegen/src/mappings/index.ts packages/codegen/src/mappings/fields.test.ts
git commit -m "feat(codegen): 常用字段映射（上）"
```

---

### Task 12: 字段映射 B（time / time-range / date / date-range / rate / color / slider / cascader）

**Files:**
- Modify: `packages/codegen/src/mappings/fields.ts`
- Modify: `packages/codegen/src/mappings/index.ts`
- Test: `packages/codegen/src/mappings/fields.test.ts`

**Interfaces:**
- Produces: `registerFieldMappings(registry)` 注册全部 15 个字段映射。

- [ ] **Step 1: 写失败测试**

```ts
it('time/date 生成对应 picker 与格式属性', async () => {
  const time = (await generateVueSfc(schemaWith([
    fieldNode('time', { format: 'HH:mm', valueFormat: 'HH:mm:ss' }),
  ]))).code
  expect(time).toContain('<el-time-picker')
  expect(time).toContain('format="HH:mm"')
  expect((await generateVueSfc(schemaWith([fieldNode('date', { type: 'date' })]))).code).toContain('<el-date-picker')
})

it('time-range/date-range 带 is-range', async () => {
  expect((await generateVueSfc(schemaWith([fieldNode('time-range', {})]))).code).toContain('is-range')
  expect((await generateVueSfc(schemaWith([fieldNode('date-range', {})]))).code).toContain('is-range')
})

it('rate/slider/color/cascader 关键属性', async () => {
  expect((await generateVueSfc(schemaWith([fieldNode('rate', { max: 10, allowHalf: true })]))).code).toContain(':max="10"')
  expect((await generateVueSfc(schemaWith([fieldNode('slider', { range: true, vertical: true })]))).code).toContain('vertical')
  expect((await generateVueSfc(schemaWith([fieldNode('color', { showAlpha: true })]))).code).toContain('show-alpha')
  expect((await generateVueSfc(schemaWith([fieldNode('cascader', { optionItems: [] })]))).code).toContain('<el-cascader')
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/codegen test -- fields`
Expected: FAIL。

- [ ] **Step 3: 实现 8 个映射**

- time/time-range：`el-time-picker`，range 加 `is-range`，format/valueFormat/placeholder/start/end/readonly/editable。
- date/date-range：`el-date-picker`，type、format/valueFormat、is-range。
- rate：`el-rate`，max/low/high/allowHalf/showText/showScore。
- color：`el-color-picker`，showAlpha。
- slider：`el-slider`，min/max/step/range/showStops/vertical/height。
- cascader：`el-cascader`，`:options` 来自 optionItems，multiple/checkStrictly/showAllLevels/clearable/filterable。
- 全部 `field: true`；`initialValue`：date/time/rate/color/cascader → `null`，range 类型 → `[]`，slider → `0`。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/codegen test -- fields`
Expected: PASS。

```bash
git add packages/codegen/src/mappings/fields.ts packages/codegen/src/mappings/index.ts packages/codegen/src/mappings/fields.test.ts
git commit -m "feat(codegen): 常用字段映射（下）"
```

---

### Task 13: 生成物挂载测试工具 + 基础交互验证

**Files:**
- Create: `packages/editor/src/integration/generated-harness.ts`
- Rewrite: `packages/editor/src/integration/generated-runs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function mountGeneratedSfc(code: string): Promise<{ wrapper: VueWrapper }>
  ```
  用 `@vue/compiler-sfc` 的 `compileScript(descriptor, { id, inlineTemplate: true })` 编译，
  重写 `import` 为注入的模块，`new Function` 求值后交给 `@vue/test-utils` 挂载。

- [ ] **Step 1: 写失败测试**

```ts
it('表单 label、初始值与必填校验可用', async () => {
  const { code } = await generateVueSfc(schemaWith([
    { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
  ]))
  const { wrapper } = await mountGeneratedSfc(code)
  expect(wrapper.text()).toContain('姓名')
  const form = wrapper.findComponent({ name: 'ElForm' })
  expect(form.props('labelWidth')).toBe('80px')
  const input = wrapper.find('input')
  expect((input.element as HTMLInputElement).value).toBe('')
  await expect(form.vm.validate()).rejects.toBeTruthy()
})

it('输入后 v-model 与校验错误更新', async () => {
  const { code } = await generateVueSfc(schemaWith([
    { id: 'f1', name: 'userName', type: 'input', props: { label: '姓名', required: true } },
  ]))
  const { wrapper } = await mountGeneratedSfc(code)
  const input = wrapper.find('input')
  await input.setValue('张三')
  expect(wrapper.text()).not.toContain('字段值不可为空')
  await expect(wrapper.findComponent({ name: 'ElForm' }).vm.validate()).resolves.toBe(true)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/editor test -- generated-runs`
Expected: FAIL（harness 不存在）。

- [ ] **Step 3: 实现 harness**

- `parse` SFC → descriptor；`compileScript(..., { inlineTemplate: true, templateOptions: { compilerOptions: { mode: 'function' } } })`。
- 用正则替换 `import { ... } from 'vue'` / `'element-plus'` / `'@element-plus/icons-vue'` / `'@vueup/vue-quill'`，删除 CSS import；把 `export default` 改为 `return`；`new Function('vue', 'elementPlus', 'icons', 'quill', code)` 求值。
- `happy-dom` 下补 `ResizeObserver`（与 `canvas-smoke.test.ts` 一致）。
- 用 `mount(component)`；Element Plus 组件已由生成物局部导入，无需全局注册。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lowcode/editor test -- generated-runs`
Expected: PASS。

```bash
git add packages/editor/src/integration/generated-harness.ts packages/editor/src/integration/generated-runs.test.ts
git commit -m "test(editor): 生成物真实挂载与校验"
```

---

### Task 14: 10 模板语料回归

**Files:**
- Create: `packages/editor/src/integration/templates-codegen.test.ts`
- Modify: `docs/designer-ui.md`

**Interfaces:**
- Consumes: `BUILTIN_TEMPLATES`、`normalizePageSchema`、`generateVueSfc`、`compileScript`/`parse`、`mountGeneratedSfc`。
- 覆盖：除「固定表格表单」（picture-upload）与「数据列表页」（data-table）之外的 10 个模板。

- [ ] **Step 1: 写失败测试**

```ts
const P0_TEMPLATES = BUILTIN_TEMPLATES.filter(
  (t) => !['fixed-table', 'list'].includes(t.id),
)

it.each(P0_TEMPLATES.map((t) => [t.name, t] as const))('%s：生成、编译、无未知物料', async (_name, template) => {
  const raw = template.create() as PageSchema
  const normalized = normalizePageSchema(raw)
  for (const schema of [raw, normalized]) {
    const { code, warnings } = await generateVueSfc(schema)
    expect(code).not.toContain('未注册物料')
    expect(code).not.toContain('@lowcode/')
    expect(code).not.toContain('xState')
    expect(() => compileScript(parse(code).descriptor, { id: 't' })).not.toThrow()
    expect(warnings.filter((w) => w.code === 'unknown-material')).toEqual([])
  }
})

it('登录模板可真实挂载，渲染两个输入框与登录按钮', async () => {
  const schema = BUILTIN_TEMPLATES.find((t) => t.id === 'login')!.create() as PageSchema
  const { code } = await generateVueSfc(schema)
  const { wrapper } = await mountGeneratedSfc(code)
  expect(wrapper.findAll('input').length).toBe(2)
  expect(wrapper.text()).toContain('登录')
})

it('原始模板即使没有 modelValue 也生成字段', async () => {
  const raw = BUILTIN_TEMPLATES.find((t) => t.id === 'single')!.create() as PageSchema
  const fieldTypes = new Set(['input', 'textarea', 'checkbox', 'switch', 'time-range', 'slider'])
  const expected = raw.nodes.filter((n) => fieldTypes.has(n.type)).length
  const { code } = await generateVueSfc(raw)
  expect((code.match(/<el-form-item/g) ?? []).length).toBe(expected)
})
```

- [ ] **Step 2: 运行并确认失败**

Run: `pnpm --filter @lowcode/editor test -- templates-codegen`
Expected: FAIL（新文件/部分映射缺失）。

- [ ] **Step 3: 修到通过**

按失败逐项补映射或 attrs；不要放宽断言。若某模板使用了 P1 物料（不应出现在这 10 个里），说明范围判断有误，修测试列表而不是静默放行。

- [ ] **Step 4: 更新文档并跑全量验证**

在 `docs/designer-ui.md` 第六节补充：生成物为纯 Element Plus、依赖边界、P0 覆盖范围（P1/P2 待补）。

Run:

```bash
pnpm --filter @lowcode/schema test
pnpm --filter @lowcode/codegen test
pnpm --filter @lowcode/editor test
pnpm -r typecheck
pnpm --filter @lowcode/playground build
```

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/editor/src/integration/templates-codegen.test.ts docs/designer-ui.md
git commit -m "test(codegen): 10 个内置模板生成回归"
```

---

## P0 完成标准

- 10/12 内置模板可生成、可编译、可挂载；无 `@lowcode/` import、无未知物料。
- 表单设置、字段初始值、必填/格式校验在生成页真实生效（挂载测试覆盖）。
- 未经过 editor 的原始 Schema 也能正确识别字段。
- `pnpm -r test`、`pnpm -r typecheck`、playground build 全绿。

## 后续计划（不在本文件）

- **P1**：picture-upload / file-upload / rich-editor / data-table，具名插槽、`props.class`、style 转义、loop key、表单事件、functions/cssCode；语料补到 12/12。
- **P2**：动作全集、数据源全类型、schema.rules、submit/refresh、onValidate。
- **P3**：SfcDialog warnings UI、旧 API 清理、文档收尾、真机回归。
