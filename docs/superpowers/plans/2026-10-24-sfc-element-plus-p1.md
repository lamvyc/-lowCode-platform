# 生成 SFC（纯 Element Plus）P1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 P0 基础上补齐 P1：data-table、picture/file upload、rich-editor、具名插槽、v-if/v-for、表单事件与 functions，并把模板语料补到 12/12。

**Architecture:** 继续使用 P0 的 `MappingRegistry` + `buildPlan` + generator；新增 `model`（v-model 目标）与 `sideEffectImports` 两个映射能力；静态数据源先落地，动态数据源留给 P2。

**Tech Stack:** 同 P0。

**Spec:** `docs/superpowers/specs/2026-10-24-sfc-element-plus-design.md`

## Global Constraints

- 生成物只 import `vue`、`element-plus`；rich-editor 额外 import `@vueup/vue-quill` 及其 CSS；图标按需 `@element-plus/icons-vue`。
- 字段默认 `v-model`；upload 用 `model: 'none'` + 手写同步；rich-editor 用 `model: 'content'`。
- 生成物不得出现 `@lowcode/*`。
- 新增映射必须有生成物断言；12 模板 raw + normalized 都要生成、编译、挂载。
- 每任务 TDD：先写失败测试，再实现，再全量验证，再提交。

---

### Task 1: 映射能力扩展（model / sideEffectImports）+ 静态数据源

**Files:**
- Modify: `packages/codegen/src/mappings/types.ts`
- Modify: `packages/codegen/src/generator.ts`
- Modify: `packages/codegen/src/generator.test.ts`

**Interfaces:**
- `ElementMapping` 新增：
  ```ts
  /** 字段的 v-model 目标：默认 value；rich-editor 用 content；upload 用 none */
  model?: 'value' | 'content' | 'none'
  /** 生成物需要副作用 import（如 Quill CSS） */
  sideEffectImports?: string[]
  ```
- generator：
  - 字段 `model !== 'none'` 时加 `v-model` / `v-model:content`。
  - `sideEffectImports` 去重后生成 `import '...'` 行。
  - `schema.dataSources` 中 `type === 'static'` 生成 `const <ref> = ref(<staticData>)`；
    其他 type 生成 `const <ref> = ref(null)` + warning `datasource-deferred`（P2 补齐）。

- [ ] **Step 1: 写失败测试**

```ts
it('model=content 生成 v-model:content，model=none 不生成 v-model', async () => {
  const registry = createDefaultRegistry()
  registry.register('content-field', { tag: 'el-input', field: true, model: 'content', attrs: () => ({}), initialValue: () => '' })
  registry.register('plain-field', { tag: 'el-input', field: true, model: 'none', attrs: () => ({}), initialValue: () => '' })
  const content = await new VueSfcGenerator({ registry }).generate(schemaWith([{ id: 'a', name: 'a', type: 'content-field', props: {} }]))
  const none = await new VueSfcGenerator({ registry }).generate(schemaWith([{ id: 'b', name: 'b', type: 'plain-field', props: {} }]))
  expect(content.code).toContain('v-model:content="formData.a"')
  expect(none.code).not.toContain('v-model')
})

it('sideEffectImports 生成 CSS import', async () => {
  const registry = createDefaultRegistry()
  registry.register('rich', { tag: 'el-input', field: true, sideEffectImports: ['@vueup/vue-quill/dist/vue-quill.snow.css'], attrs: () => ({}), initialValue: () => '' })
  const { code } = await new VueSfcGenerator({ registry }).generate(schemaWith([{ id: 'r', name: 'r', type: 'rich', props: {} }]))
  expect(code).toContain("import '@vueup/vue-quill/dist/vue-quill.snow.css'")
})

it('静态数据源生成 ref，动态数据源给 warning', async () => {
  const schema = schemaWith([])
  schema.dataSources = [
    { id: 'userList', name: '用户', type: 'static', config: { staticData: { data: [{ name: '张三' }] } } },
    { id: 'remote', name: '远程', type: 'rest', config: { url: '/api' } },
  ]
  const { code, warnings } = await generateVueSfc(schema)
  expect(code).toContain('const userList = ref({')
  expect(code).toContain('const remote = ref(null)')
  expect(warnings.some((warning) => warning.code === 'datasource-deferred')).toBe(true)
})
```

- [ ] **Step 2: 运行并确认失败**

`pnpm --filter @lowcode/codegen test -- generator`

- [ ] **Step 3: 实现**

- generator 字段分支根据 `current.model ?? 'value'` 添加 v-model。
- `sideEffectImports`：遍历 schema 节点映射，收集去重，script 中输出。
- 数据源：在 script consts 前生成 static ref 与动态占位；warning 只对非 static。
- 注意 `ref` 已默认 import，无需额外判断。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test` → PASS。

```bash
git add packages/codegen/src/mappings/types.ts packages/codegen/src/generator.ts packages/codegen/src/generator.test.ts
git commit -m "feat(codegen): 映射 model/副作用 import 与静态数据源"
```

---

### Task 2: data-table 映射 + 数据列表页 12/12

**Files:**
- Create: `packages/codegen/src/mappings/advanced.ts`
- Modify: `packages/codegen/src/mappings/index.ts`
- Test: `packages/codegen/src/mappings/advanced.test.ts`
- Modify: `packages/editor/src/integration/templates-codegen.test.ts`（把 list 加入 P1 列表）

**Interfaces:**
- `registerAdvancedMappings(registry)`；`data-table` 非字段。

- [ ] **Step 1: 写失败测试**

```ts
it('data-table 生成 el-table + 列定义 + 表达式数据', async () => {
  const { code } = await generateVueSfc(schemaWith([{
    id: 't1', name: 'table', type: 'data-table',
    props: {
      data: { type: 'expression', value: '$datasource.userList.data' },
      columns: [{ prop: 'name', label: '姓名', width: 120 }],
      stripe: true, border: true,
    },
  }], [staticDataSource('userList')]))
  expect(code).toContain('<el-table')
  expect(code).toContain(':data="userList?.data"')
  expect(code).toContain('<el-table-column')
  expect(code).toContain('prop="name"')
  expect(code).toContain('stripe')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- advanced`

- [ ] **Step 3: 实现**

- `data-table`：`el-table`；`:data` 用 `rewriteExpression(..., 'template')`；`stripe/border` bool；children 显式渲染 `el-table-column`（prop/label/width）。
- 注册进 `createDefaultRegistry`。
- 更新 corpus：`P1_TEMPLATES` 排除 fixed-table（picture-upload 在 Task 3），先加 list；逐步补全。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test && pnpm --filter @lowcode/editor test -- templates-codegen`

```bash
git add packages/codegen/src/mappings/advanced.ts packages/codegen/src/mappings/advanced.test.ts packages/codegen/src/mappings/index.ts packages/editor/src/integration/templates-codegen.test.ts
git commit -m "feat(codegen): data-table 映射"
```

---

### Task 3: picture-upload / file-upload

**Files:**
- Modify: `packages/codegen/src/mappings/advanced.ts`
- Test: `packages/codegen/src/mappings/advanced.test.ts`
- Modify: `packages/editor/src/integration/templates-codegen.test.ts`（加入 fixed-table）

**Interfaces:**
- `picture-upload` / `file-upload`：`field: true`, `model: 'none'`。
- 生成：
  - `el-upload`，`:file-list="formData.<key>"`，`:auto-upload` 依 `uploadURL`，`:limit`、`:show-file-list`、`:multiple`、`:with-credentials`、`:before-upload`、`:on-success`、`:on-error`、`:on-remove`、`:on-change`（无 URL 时本地预览）。
  - setup 生成 `beforeUpload_x / onUploadSuccess_x / onUploadError_x / onRemove_x / onChange_x`；上传成功/本地预览写入 `formData.<key>` 的 `{ name, url }`。
  - `ElMessage` 通过 `imports` 引入；`fileMaxSize/fileTypes` 校验。

- [ ] **Step 1: 写失败测试**

```ts
it('picture-upload 生成 el-upload 与文件同步函数', async () => {
  const { code } = await generateVueSfc(schemaWith([fieldNode('picture-upload', { uploadURL: '', limit: 3 })]))
  expect(code).toContain('<el-upload')
  expect(code).toContain('list-type="picture-card"')
  expect(code).toContain(':file-list="formData.picture_upload"')
  expect(code).toContain('beforeUpload_picture_upload')
  expect(code).toContain('onUploadSuccess_picture_upload')
  expect(code).toContain('ElMessage')
})

it('file-upload 不带 picture-card，且 auto-upload 跟 URL', async () => {
  const { code } = await generateVueSfc(schemaWith([fieldNode('file-upload', { uploadURL: '/api/upload' })]))
  expect(code).toContain('<el-upload')
  expect(code).not.toContain('list-type="picture-card"')
  expect(code).toContain(':auto-upload="true"')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- advanced`

- [ ] **Step 3: 实现**

- handlers 使用 `formData` 的模型名与 modelKey（`ctx.form.modelName` / `ctx.modelKey`）。
- `beforeUpload`：`ElMessage.error('文件大小不能超过 NMB')` / `'文件类型不支持'`，返回 false。
- `onSuccess`：从 `response?.url` / `file.url` 取地址，push `{ name, url }`；`onRemove` 按 url/name 过滤。
- 无 URL 时 `:auto-upload="false"`，`onChange` 用 `URL.createObjectURL(file.raw)` 生成本地预览。
- `imports` 加 `ElMessage`。
- 固定表格模板语料加入；mount 断言 `.el-upload` 存在。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test && pnpm --filter @lowcode/editor test -- templates-codegen`

```bash
git add packages/codegen/src/mappings/advanced.ts packages/codegen/src/mappings/advanced.test.ts packages/editor/src/integration/templates-codegen.test.ts
git commit -m "feat(codegen): 图片/文件上传映射"
```

---

### Task 4: rich-editor（Quill）

**Files:**
- Modify: `packages/codegen/src/mappings/advanced.ts`
- Test: `packages/codegen/src/mappings/advanced.test.ts`

**Interfaces:**
- `rich-editor`：`field: true`, `model: 'content'`，tag `QuillEditor`，imports + CSS side effect。

- [ ] **Step 1: 写失败测试**

```ts
it('rich-editor 生成 QuillEditor + v-model:content + CSS import', async () => {
  const { code } = await generateVueSfc(schemaWith([fieldNode('rich-editor', { placeholder: '请输入', disabled: true })]))
  expect(code).toContain("import { QuillEditor } from '@vueup/vue-quill'")
  expect(code).toContain("import '@vueup/vue-quill/dist/vue-quill.snow.css'")
  expect(code).toContain('<QuillEditor')
  expect(code).toContain('v-model:content="formData.rich_editor"')
  expect(code).toContain('content-type="html"')
  expect(code).toContain(':read-only="true"')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- advanced`

- [ ] **Step 3: 实现**

- attrs：`content-type="html"`、`theme="snow"`、`toolbar="full"`、`:read-only`、placeholder。
- imports：`QuillEditor` + sideEffect CSS。
- 不参与 12 模板挂载（模板未使用），只做生成物断言与 compile。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test`

```bash
git add packages/codegen/src/mappings/advanced.ts packages/codegen/src/mappings/advanced.test.ts
git commit -m "feat(codegen): rich-editor Quill 映射"
```

---

### Task 5: 具名插槽 + v-if / v-for / key

**Files:**
- Modify: `packages/codegen/src/mappings/helpers.ts`
- Modify: `packages/codegen/src/generator.ts`
- Test: `packages/codegen/src/generator.test.ts`

**Interfaces:**
- `renderChildren` 渲染 `node.slots` 非 default 为 `<template #name>`；default 回退 `children ?? slots.default`。
- generator 为字段 form-item / 非字段标签加：
  - `v-if` 来自 `bindings.visible`（模板模式重写 / 静态布尔）
  - `v-for` 来自 `bindings.loop`，并加 `:key="index"`（无 key 时）

- [ ] **Step 1: 写失败测试**

```ts
it('具名插槽与 v-if/v-for', async () => {
  const schema = schemaWith([{
    id: 'box', type: 'card', props: {}, children: ['t'],
    slots: { extra: ['s'] },
  }, { id: 't', type: 'static-text', props: { textContent: 'A' } },
     { id: 's', type: 'static-text', props: { textContent: 'B' } }])
  schema.nodes[0].bindings = {
    visible: { type: 'expression', value: '$page.show' },
    loop: { type: 'static', value: { source: '$datasource.list', itemName: 'item' } },
  }
  schema.variables = [{ id: 'v', name: 'show', value: true }]
  schema.dataSources = [{ id: 'list', name: 'list', type: 'static', config: { staticData: [] } }]
  const { code } = await generateVueSfc(schema)
  expect(code).toContain('<template #extra>')
  expect(code).toContain('v-if="show"')
  expect(code).toContain('v-for="item in list"')
  expect(code).toContain(':key="index"')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- generator`

- [ ] **Step 3: 实现**

- `renderChildren` 追加 slots（非 default），default 回退。
- generator `applyBindings(node, target)`：v-if/v-for/key；字段应用到 form-item，非字段应用到元素。
- 静态 visible 用 `JSON.stringify(Boolean(value))`；表达式用模板模式。
- loop 支持静态 config 与表达式（表达式按 `{itemName:'item', indexName:'index'}` 处理）。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test`

```bash
git add packages/codegen/src/mappings/helpers.ts packages/codegen/src/generator.ts packages/codegen/src/generator.test.ts
git commit -m "feat(codegen): 具名插槽与可见/循环绑定"
```

---

### Task 6: 表单事件 + functions

**Files:**
- Modify: `packages/codegen/src/generator.ts`
- Test: `packages/codegen/src/generator.test.ts`

**Interfaces:**
- `settings.form.functions` 原样注入 script。
- `onFormCreated` setup 末尾执行；`onFormMounted` onMounted；`onFormDataChange` 每字段 watch。
- 按需 import `onMounted, watch`。

- [ ] **Step 1: 写失败测试**

```ts
it('form functions 与三个表单事件进入生成物', async () => {
  const schema = schemaWith([{ id: 'f1', name: 'a', type: 'input', props: { label: 'A' } }])
  schema.settings = { form: {
    functions: 'function hello() { return 1 }',
    onFormCreated: 'console.log("created")',
    onFormMounted: 'console.log("mounted")',
    onFormDataChange: 'console.log(fieldName, newValue)',
  } }
  const { code } = await generateVueSfc(schema)
  expect(code).toContain('function hello()')
  expect(code).toContain('console.log("created")')
  expect(code).toContain('onMounted(')
  expect(code).toContain('watch(')
  expect(code).toContain('onFormDataChange')
})
```

- [ ] **Step 2: 运行失败**：`pnpm --filter @lowcode/codegen test -- generator`

- [ ] **Step 3: 实现**

- functions 注入在 consts 后、setup lines 前。
- onFormCreated 包 try/catch 追加。
- onFormMounted 用 `onMounted(() => { try { ... } catch ... })`。
- onFormDataChange：每个字段 `watch(() => formData.key, (nv, ov) => { try { code } catch ... })`，参数名固定 `fieldName, newValue, oldValue, formModel`，用局部变量传值。
- import 按需要加入 `onMounted`/`watch`。

- [ ] **Step 4: 验证并提交**

`pnpm --filter @lowcode/codegen test`

```bash
git add packages/codegen/src/generator.ts packages/codegen/src/generator.test.ts
git commit -m "feat(codegen): 表单事件与全局函数"
```

---

### Task 7: 12/12 模板 + 文档

**Files:**
- Modify: `packages/editor/src/integration/templates-codegen.test.ts`
- Modify: `docs/designer-ui.md`

- [ ] **Step 1: 把 P1_TEMPLATES 改为全部 12 个**

移除 `fixed-table` / `list` 排除；每个模板 raw + normalized 生成、编译、挂载；断言 `.lc-page`。
- fixed-table：`.el-upload` 存在。
- list：`.el-table` 存在；行数据来自静态数据源。

- [ ] **Step 2: 运行**

`pnpm --filter @lowcode/editor test -- templates-codegen`

- [ ] **Step 3: 修到通过并更新文档**

P1 覆盖说明；依赖边界（Quill）。

- [ ] **Step 4: 全量验证并提交**

```bash
pnpm -r test
pnpm -r typecheck
pnpm --filter @lowcode/playground build
git add ...
git commit -m "test(codegen): 12/12 模板生成回归"
```

## P1 完成标准

- 12/12 模板生成、编译、挂载通过。
- upload/rich-editor/data-table 有生成物断言；fixed-table/list 真实挂载。
- 具名插槽、v-if/v-for、表单事件、functions 生成并编译。
- 全量测试/typecheck/build 绿。

## 后续

P2：动作全集、数据源全类型、schema.rules、生命周期钩子、恢复 5 个 skipped 测试。
P3：SfcDialog warnings UI、旧 API 清理、真机回归。
