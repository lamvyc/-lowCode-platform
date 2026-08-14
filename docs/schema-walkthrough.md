# Schema 代码级走读（新手向）

> 目标读者：刚接触本仓库、想搞懂“Schema 到底是什么、代码是怎么写的、测试是怎么写的”的人。
> 本文不聊抽象概念，全部对着真实代码讲，引用的行号以当前仓库代码为准。

## 0. 一句话结论

**Schema = 一个普通 JS 对象**（比如 `{ version: '2.0.0', kind: 'Page', ... }`）。
它自己不干活，只是数据；程序按“它应该长什么样”的约定去读它。这个约定被写了两遍：

1. **类型定义**（`types/*.ts` 里的 `interface`）——写代码时给人和编辑器看；
2. **校验器**（`validation/schema.zod.ts`）——运行时真的检查，不合格就抛错。

## 1. 代码地图

```text
packages/schema/src/
├── index.ts                    # 出口：把所有功能对外导出
├── types/                      # 约定层：对象长什么样的“模板”
│   ├── schema.ts               #   统一骨架：SchemaEnvelope（五层公共外壳）
│   ├── action.ts               #   标准 Action 枚举（8 个动作）
│   ├── expression.ts           #   表达式沙箱 + 四层上下文白名单
│   ├── pageSpec.ts             #   页面层 spec（节点/数据源/交互）
│   ├── datamodel.ts            #   数据模型层 spec（字段/关联/权限）
│   ├── process.ts              #   流程层 spec（节点/边）
│   ├── api.ts                  #   API 层 spec（端点/入参/出参）
│   ├── plugin.ts               #   插件层 spec（JSON Schema 属性面板）
│   └── ...（node/event/material 等旧版类型）
├── validation/
│   ├── schema.zod.ts           # 校验层：zod 写的“安检规则”
│   └── validate.ts             # 入口层：parseSchema 等对外函数
├── migration/registry.ts       # 迁移：旧版 1.x → 统一 2.x
├── serialize/serializer.ts     # 序列化：JSON 字符串 ↔ 对象
└── normalize.ts                # 适配层：统一页面 → 旧版运行时视图
```

## 2. 约定层：一个 Schema 必须长什么样

文件：[types/schema.ts](/Users/unravel/ lowCode-platform/packages/schema/src/types/schema.ts)

第 54 行开始定义了“统一信封”：

```ts
export interface SchemaEnvelope<K extends SchemaKind = SchemaKind, S = unknown> {
  version: string   // 版本号，必须是字符串
  kind: K           // 类型，只能是 Page/DataModel/Process/API/Plugin 之一
  metadata: ...     // 元信息：id、name、创建/更新时间
  spec: S           // 各层自己的内容（页面有 nodes，数据模型有 fields）
  migrations?: ...  // 可选的迁移记录
}
```

`interface` 在 TypeScript 里就是“**约定**”：凡是叫 `SchemaEnvelope` 的对象，必须带 `version`、`kind`、`metadata`、`spec` 四个字段。

`kind` 的取值写死在第 15 行：

```ts
export type SchemaKind = 'Page' | 'DataModel' | 'Process' | 'API' | 'Plugin'
```

这就是五层结构的由来——不是文档里的口号，是代码里的一行类型定义。

## 3. 校验层：谁在运行时检查

文件：[schema.zod.ts](/Users/unravel/ lowCode-platform/packages/schema/src/validation/schema.zod.ts)

这里用了校验库 **zod**：把 `interface` 的约定再写成规则，运行时逐条检查。

### 3.1 版本号规则（第 22–25 行）

```ts
export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, '版本号必须符合语义化版本规范 major.minor.patch')
```

翻译：`version` 必须是“数字.数字.数字”。写 `'2.0'` 或 `'v2.0.0'` 都会被拒。

### 3.2 五层分发（第 469–482 行）

```ts
const envelopeBase = {
  version: semverSchema,
  metadata: schemaMetadataSchema,
  migrations: z.array(schemaMigrationSchema).optional(),
}

export const schemaEnvelopeSchema = z
  .union([
    z.object({ ...envelopeBase, kind: z.literal('Page'), spec: pageSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('DataModel'), spec: dataModelSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('Process'), spec: processSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('API'), spec: apiSpecSchema }),
    z.object({ ...envelopeBase, kind: z.literal('Plugin'), spec: pluginSpecSchema }),
  ])
```

`z.union([...])` = “五个模板里必须匹配一个”。匹配键是 `kind: z.literal('Page')`——
**如果 kind 是 'Page'，spec 必须符合页面规则；是 'DataModel' 就必须符合数据模型规则**，对不上就抛错。

### 3.3 标准动作枚举（types/action.ts 第 4–13 行）

```ts
export const STANDARD_ACTION_TYPES = [
  'navigate',      // 页面跳转
  'submit',        // 表单提交
  'openDialog',    // 打开弹窗
  'closeDialog',   // 关闭弹窗
  'invokeAPI',     // 调用 API
  'dispatchEvent', // 触发自定义事件
  'setState',      // 更新组件/页面状态
  'refresh',       // 刷新数据源
] as const
```

页面节点的事件里写 `type: 'setState'` 就是从这个枚举里取。写成枚举的好处：IDE 有自动补全、写错能尽早发现；同时 `type` 也接受插件自定义的动作类型字符串（`UnifiedActionType = ActionType | (string & {})`），自定义动作由 ActionRegistry 按 type 查找实现。运行时校验只要求 type 非空（`z.string().min(1)`），标准类型的防呆由设计器在编辑态对枚举做提示。

## 4. 入口层：安检通道

文件：[validate.ts](/Users/unravel/ lowCode-platform/packages/schema/src/validation/validate.ts)

第 38–40 行是核心入口：

```ts
export function parseSchema(input: unknown): SchemaEnvelope {
  return schemaEnvelopeSchema.parse(input)
}
```

`parseSchema` = “**把对象丢进安检机**”：合法就原样返回，不合法抛异常。同文件还有几个配套函数：

| 函数 | 行号 | 作用 |
| --- | --- | --- |
| `parsePageSchema` | 28 | 校验旧版扁平页面（1.x） |
| `isPageSchema` | 33 | 只判断“是不是”，不抛错 |
| `parseSchema` | 38 | 校验任意层统一 Schema（2.x） |
| `isSchemaEnvelope` | 43 | 只判断“是不是统一信封”，不抛错 |
| `getSchemaKind` | 48 | 读出一个对象的 kind |

## 5. 测试怎么写、怎么读

文件：[unified.test.ts](/Users/unravel/ lowCode-platform/packages/schema/src/unified.test.ts)

测试是“**造数据 → 调用 → 断言**”三段式。看第 29–39 行：

```ts
describe('统一 Schema 骨架（P5）', () => {          // ① 给一组测试起名
  it('parseSchema 接受语义化版本号', () => {        // ② 一个用例：“应该发生什么”
    const schema = createUnifiedPageSchema(makeMeta('p1', '测试页'), { nodes: [] })
    //              ③ 造数据：工厂函数帮你生成一份合法页面

    expect(parseSchema(schema).version).toBe(UNIFIED_SCHEMA_VERSION)
    //     ④ 调用        ⑤ 断言：过完安检，版本号必须是 2.0.0
  })

  it('parseSchema 拒绝非 semver 版本号', () => {
    const bad = createUnifiedPageSchema(makeMeta('p1', '测试页'), { nodes: [] })
    expect(() => parseSchema({ ...bad, version: '2.0' })).toThrow()
    //                          ⑥ 把版本改成非法的  ⑦ 断言：必须抛错
  })
})
```

四个关键词就够了：

- `describe('名字')` —— 给一组测试分类
- `it('名字')` —— 一个测试用例，名字即预期行为
- `expect(实际值).toBe(期望值)` —— 结果必须相等
- `expect(() => ...).toThrow()` —— 调用必须抛错

“造数据”用的 `createUnifiedPageSchema` 等工厂函数在 [validate.ts](/Users/unravel/ lowCode-platform/packages/schema/src/validation/validate.ts)（第 75 行往后），它们只是把参数组装成对象，真正的检查在 `parseSchema`。

## 6. 怎么跑、输出怎么读

```bash
pnpm --filter @lowcode/schema test
```

实测输出：

```text
✓ src/schema.test.ts (6 tests)
✓ src/normalize.test.ts (4 tests)
✓ src/unified.test.ts (16 tests)
Tests  26 passed (26)
```

`✓` 绿勾 = 该文件所有用例断言通过。如果断言失败，会打印红叉，并给出“期望值 vs 实际值”和具体行号，照着改即可。

## 7. 整条链路

```text
你写的 / 编辑器生成的 JSON（比如 playground 的 demo 页面）
        ↓
parseSchema(input)                  ← 安检：不合格抛错（validate.ts）
        ↓ 通过
SchemaEnvelope（类型安全的对象）
        ↓
RuntimeContext                      ← runtime/context.ts 真正消费：
                                       读 nodes 渲染、读 dataSources 取数
```

所以：**schema 是数据，validate.ts 负责检查，runtime 负责消费，测试负责保证检查和消费不被打坏。**

## 8. 常见问题

**Q：为什么不用 Node 直接 import src 来做实验？**
A：源码里的相对导入省略了 `.ts` 扩展名，Node 原生 ESM 解析会报 `Cannot find module`。请用 vitest（见第 6 节）或项目脚本。

**Q：临时验证文件放哪？**
A：放进 `packages/schema/src/`（vitest 只收集 `src/**/*.test.ts`），用完立刻删除——否则会被 typecheck 纳入、编译进 `dist`，还会改变全仓测试计数。

**Q：zod 和 interface 是不是重复了？**
A：是有意为之。`interface` 给编辑器/编译器看，zod 在运行时检查真实数据（数据可能来自后端、文件、用户输入，编译期管不到）。一套约定、两道防线。

## 9. 相关文档

- [MANUAL_VERIFICATION.md](/Users/unravel/ lowCode-platform/packages/schema/MANUAL_VERIFICATION.md)：手动验证流程 + Schema 新旧示例对照
- [architecture.md](/Users/unravel/ lowCode-platform/docs/architecture.md)：五层架构映射
