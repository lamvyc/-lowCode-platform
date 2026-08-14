# @lowcode/schema 手动验证指南

本文档说明如何手动验证 `packages/schema`（统一五层 Schema：Page / DataModel / Process / API / Plugin）的实现是否符合设计原则。所有命令均在仓库根目录或 `packages/schema` 目录下执行，**本文档中的探针代码与命令均已实测通过**。

## 1. 前置条件

- Node.js >= 20（实测 v24.18.0）、pnpm 9
- 无需先构建：vitest / vite 直接消费 `src/` 下的 TypeScript 源码

> ⚠️ 不要用 `node` 直接 `import('./packages/schema/src/index.ts')` 做验证：源码的相对导入省略了 `.ts` 扩展名，Node 原生 ESM 解析会报 `Cannot find module`。请统一使用 vitest 或 pnpm 脚本。

## 2. 自动化回归基线（任何修改后先跑）

```bash
# schema 包内
pnpm --filter @lowcode/schema test       # 预期: 26 passed（3 个测试文件）
pnpm --filter @lowcode/schema typecheck  # 预期: tsc --noEmit 无输出、exit 0
pnpm --filter @lowcode/schema build      # 预期: tsc -p tsconfig.build.json 生成 dist

# 全仓回归（防止 schema 类型改动破坏下游）
pnpm -r test                             # 预期: 123 passed
pnpm -r typecheck                        # 预期: 7 个包全部 Done
```

## 3. 手动验证方案 A：一次性探针测试（推荐，逐项肉眼确认）

### 步骤

1. 把下面的探针代码保存为 `packages/schema/src/manual-check.test.ts`（临时文件）；
2. 运行：

   ```bash
   cd packages/schema
   pnpm exec vitest run src/manual-check.test.ts
   ```

3. 预期输出：

   ```text
   ✓ src/manual-check.test.ts (7 tests)
   Test Files  1 passed (1)
        Tests  7 passed (7)
   ```

4. **验证完必须删除该文件**（见第 6 节注意事项）。

### 探针代码

```ts
import { describe, expect, it } from 'vitest'
import {
  EXPRESSION_CONTEXTS,
  SCHEMA_VERSION,
  STANDARD_ACTION_TYPES,
  UNIFIED_SCHEMA_VERSION,
  createApiSchema,
  createDataModelSchema,
  createPluginSchema,
  createProcessSchema,
  createUnifiedPageSchema,
  deserializeSchema,
  migrateToUnified,
  normalizePageSchema,
  parseSchema,
  serializeSchema,
  validateExpression,
} from '@lowcode/schema'

describe('手动验证探针（验证完删除本文件）', () => {
  it('1. 统一骨架 + semver', () => {
    const schema = createUnifiedPageSchema({ id: 'probe1', name: '探针页' }, { nodes: [] })
    expect(parseSchema(schema).version).toBe(UNIFIED_SCHEMA_VERSION)
    expect(() => parseSchema({ ...schema, version: '2.0' })).toThrow()
  })

  it('2. 标准 Action 枚举', () => {
    expect(STANDARD_ACTION_TYPES).toEqual([
      'navigate', 'submit', 'openDialog', 'closeDialog',
      'invokeAPI', 'dispatchEvent', 'setState', 'refresh',
    ])
  })

  it('3. 表达式沙箱', () => {
    expect(validateExpression('$state.keyword != ""', 'Page').ok).toBe(true)
    expect(validateExpression('eval("1+1")', 'Page').ok).toBe(false)
    expect(validateExpression('$datasource.list', 'Page').ok).toBe(false)
    expect(EXPRESSION_CONTEXTS.Process).toContain('$output')
  })

  it('4. 五层 Schema 解析', () => {
    expect(parseSchema(createDataModelSchema({ id: 'm1', name: '模型' }, {
      fields: [{ name: 'id', type: 'string' }],
      permissions: { operation: [{ role: 'admin', actions: ['create', 'read'] }] },
    })).kind).toBe('DataModel')

    expect(parseSchema(createProcessSchema({ id: 'p1', name: '流程' }, {
      nodes: [{ id: 'start', type: 'start' }],
      edges: [],
    })).kind).toBe('Process')

    expect(parseSchema(createApiSchema({ id: 'a1', name: 'API' }, {
      endpoint: '/x', method: 'GET',
    })).kind).toBe('API')

    expect(parseSchema(createPluginSchema({ id: 'pl1', name: '插件' }, {
      componentRegistry: { custom: [{ identifier: 'X', propertySchema: { type: 'object' } }] },
    })).kind).toBe('Plugin')
  })

  it('5. 旧版 1.x → 统一 2.x 迁移', () => {
    const legacy = {
      version: SCHEMA_VERSION,
      meta: {
        id: 'old1', name: '旧页',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      nodes: [{
        id: 'n1', type: 'button', props: {},
        events: { click: [{ id: 'a1', kind: 'setVariable', config: { name: 'x', value: 1 } }] },
      }],
      materials: [], dataSources: [], variables: [], rules: [],
    }
    const unified = migrateToUnified(legacy)
    expect(unified.kind).toBe('Page')
    expect(unified.spec.nodes[0]?.events?.click[0]?.type).toBe('setState')
  })

  it('6. 统一 → 旧版运行时视图归一化', () => {
    const unified = createUnifiedPageSchema({ id: 'up1', name: '归一化' }, {
      nodes: [{ id: 'n1', type: 'text', props: { text: 'hi' } }],
    })
    expect(normalizePageSchema(unified).meta.id).toBe('up1')
  })

  it('7. 序列化往返', () => {
    const schema = createApiSchema({ id: 'a1', name: 'API' }, { endpoint: '/x', method: 'GET' })
    expect(deserializeSchema(serializeSchema(schema))).toEqual(schema)
  })
})
```

### 各验证点与设计意图

| # | 验证点 | 断言了什么 | 对应原则 |
|---|--------|-----------|---------|
| 1 | 统一骨架 + semver | 合法 `2.0.0` 通过、非法 `2.0` 被拒 | P5 语义化版本 |
| 2 | 标准 Action 枚举 | 与规范枚举逐字一致（含 `submit/refresh`） | P1 声明式 |
| 3 | 表达式沙箱 | 合法表达式放行；`eval`、未声明上下文 `$datasource` 被拒；各层上下文白名单 | P3 沙箱化 |
| 4 | 五层解析 | DataModel / Process / API / Plugin 各自按 `kind` 校验通过 | P2/P4/P6 分层 |
| 5 | 迁移 | 旧版扁平 1.x → 统一 2.x，`setVariable` 归一为 `setState` | P5 兼容迁移 |
| 6 | 归一化 | 统一 Page 可转换为旧版运行时视图（`meta.id` 保留） | 渐进兼容 |
| 7 | 序列化 | 任意 kind 序列化 → 反序列化后深相等 | P5 可持久化 |

## 4. 手动验证方案 B：定向跑现有测试（不改动任何文件）

用 `-t` 按 describe / it 名称过滤，适合只复查某个能力：

```bash
cd packages/schema
pnpm exec vitest run -t "语义化版本"        # 版本校验
pnpm exec vitest run -t "表达式沙箱"        # 沙箱拒绝/放行
pnpm exec vitest run -t "DataModel Schema"  # 数据模型 + 三级权限
pnpm exec vitest run -t "Process Schema"    # 流程声明式节点/边
pnpm exec vitest run -t "Plugin Schema"     # JSON Schema 属性面板
pnpm exec vitest run -t "迁移"              # 1.x → 2.x
pnpm exec vitest run -t "统一 Page"         # 统一页面 + 标准动作
```

实测示例（只命中 1 个用例，其余 skipped）：

```text
✓ src/unified.test.ts (16 tests | 15 skipped)
Tests  1 passed | 25 skipped (26)
```

## 5. 运行时 / 跨包集成验证

统一 Page 需要渲染、编辑、存储链路可用时：

```bash
pnpm --filter @lowcode/runtime test        # 含「渲染统一 Page Schema」「$state/$api 上下文」用例
pnpm --filter @lowcode/editor test         # 编辑器入口归一化
pnpm --filter @lowcode/playground test     # 仓储对统一结构的存取往返
pnpm --filter @lowcode/core test           # 表达式命名空间（$state/$api）回归
```

## 6. Schema 示例参考（快速认识结构）

下面的示例均来自仓库真实代码：旧版页面取自 `packages/playground/src/demo-schema.ts`，统一 2.x 结构由 `migrateToUnified` 实测转换生成。

### 6.1 旧版扁平 PageSchema（1.x，demo 页面精简）

```jsonc
{
  "version": "1.0.0",
  "meta": { "id": "demo", "name": "用户管理示例", "route": "/demo" },
  "nodes": [
    {
      "id": "n_select",
      "type": "select",
      "props": { "modelValue": "option1", "placeholder": "请选择筛选条件" },
      "events": {
        "change": [
          {
            "id": "a_select",
            "kind": "setVariable",                          // 旧动作枚举
            "config": { "name": "selectValue", "expression": "event" }
          }
        ]
      }
    },
    {
      "id": "n_table",
      "type": "table",
      "props": {
        "data": { "type": "expression", "value": "$datasource.userList.data" }
      }
    }
  ],
  "dataSources": [
    {
      "id": "userList",
      "type": "static",
      "config": { "staticData": { "data": [ /* 张三 / 李四 / 王五 */ ] } }
    }
  ],
  "variables": [{ "id": "v_select", "name": "selectValue", "value": "option1" }],
  "rules": []
}
```

读法：`nodes` = 组件树，`events` = 组件事件触发动作，`dataSources` = 数据来源，`variables` = 页面状态，`rules` = 联动规则。

### 6.2 统一五层 PageSchema（2.x，同一 demo 的真实迁移结果）

```jsonc
{
  "version": "2.0.0",
  "kind": "Page",                                             // 新增：类型标识
  "metadata": { "id": "demo", "name": "用户管理示例" },       // meta → metadata
  "migrations": [                                             // 结构变更记录（P5）
    { "from": "1.0.0", "to": "2.0.0", "changes": [ /* 废弃字段与替代方案 */ ] }
  ],
  "spec": {                                                   // 内容全部收进 spec
    "route": "/demo",
    "nodes": [
      {
        "id": "n_select",
        "type": "select",
        "props": { /* 不变 */ },
        "events": {
          "change": [
            {
              "id": "a_select",
              "type": "setState",                             // kind:setVariable → type:setState
              "params": { "name": "selectValue", "expression": "event" }  // config → params
            }
          ]
        }
      }
    ],
    "dataSources": [
      {
        "id": "userList",
        "type": "static",
        "value": { "data": [ /* 数据平铺，不再套 config.staticData */ ] }
      }
    ],
    "variables": [ /* 不变 */ ],
    "interactions": []                                        // rules → interactions
  }
}
```

改动规律就三条：**顶层加 `kind`、内容收进 `spec`、旧字段换标准名**（`kind→type`、`config→params`、`rules→interactions`、`condition→expression`）。

### 6.3 五层骨架速览

```jsonc
// 数据模型：字段 + 关联 + 三级权限（P2）
{ "kind": "DataModel", "spec": {
    "fields": [{ "name": "salary", "type": "number", "validation": { "min": 0 } }],
    "permissions": { "operation": [{ "role": "editor", "actions": ["create", "update"] }] } } }

// 流程：声明式节点 + 边（分支用沙箱表达式，P1/P3）
{ "kind": "Process", "spec": {
    "nodes": [
      { "id": "start", "type": "start" },
      { "id": "decide", "type": "condition", "expression": "$output.amount > 1000" }
    ],
    "edges": [
      { "id": "e1", "from": "decide", "to": "end", "expression": "$output.amount > 1000" }
    ] } }

// API：只声明端点契约，不含处理逻辑（P6）
{ "kind": "API", "spec": {
    "endpoint": "/api/users", "method": "GET",
    "request": { "query": { "keyword": { "type": "string" } } },
    "auth": "bearer" } }

// 插件：JSON Schema 属性面板 + 插件接口（P4）
{ "kind": "Plugin", "spec": { "componentRegistry": { "custom": [
    { "identifier": "MyCustomChart", "pluginInterface": "chart-plugin",
      "propertySchema": { "type": "object", "properties": { "title": { "type": "string" } } } } ] } } }
```

### 6.4 新旧字段对照

| 旧版（1.x） | 统一（2.x） | 说明 |
| --- | --- | --- |
| `meta` | `metadata` | 元信息，新增 `kind` 顶层字段 |
| `nodes[].events[].kind` | `nodes[].events[].type` | 标准 Action 枚举（P1） |
| `events[].config` | `events[].params` | 动作参数 |
| `events[].when` | `events[].expression` | 条件统一用 expression（P3） |
| `dataSources[].config.staticData` | `dataSources[].value` | 静态数据平铺 |
| `dataSources[].config.url/method` | `type:"API"` + `ref` | 引用外部 ApiSchema（P6） |
| `rules` | `spec.interactions` | 声明式交互 |
| `rules[].condition` | `interactions[].expression` | 条件字段统一 |
| （无） | `migrations[]` | 版本迁移记录（P5） |

### 6.5 想自己重新生成示例

把下面探针放进 `packages/playground/src/demo-print.test.ts`，运行后即可看到本仓库 demo 页面的完整统一 2.x 输出（用完删除）：

```ts
import { it } from 'vitest'
import { migrateToUnified } from '@lowcode/schema'
import { createDemoSchema } from './demo-schema'

it('打印 demo 的统一 2.x 结构', () => {
  console.log(JSON.stringify(migrateToUnified(createDemoSchema()), null, 2))
})
```

```bash
cd packages/playground
pnpm exec vitest run src/demo-print.test.ts
```

## 7. 注意事项

1. **探针文件用完即删**：`tsconfig` 的 include 是 `src`，探针 `.test.ts` 会被纳入 typecheck 并编译进 `dist`；忘记删除会导致全仓测试计数变化（+7）且发布产物含探针。
2. 验证前先跑第 2 节的自动化基线；手动探针只用于解释“为什么通过”，不能替代自动化回归。
3. 若 `pnpm exec vitest run <路径>` 报 `No test files found`，是因为文件不在 `src/**/*.test.ts` 的 include 范围内，请把探针放进 `packages/schema/src/`。
4. 修改了 `types/` 或 `validation/` 后，`pnpm --filter @lowcode/schema typecheck` 必须无输出；`noUnusedLocals` 开启，未使用的导入也会报错。
