# 附加场景 12：Schema 版本与迁移

## 1. 场景

平台升级协议（v1 → v2），存量页面 JSON 需要无感升级。

## 2. 最终效果

旧版本 schema 通过迁移链自动升级到当前版本，校验失败会明确报错而非静默使用脏数据。

## 3. 完整链路

```text
旧 JSON → 读取 version
  → MigrationRegistry.findPath（BFS）
  → 依次执行 migrate
  → Zod 校验
  → 当前版本 PageSchema
```

## 4. 核心数据结构

```ts
interface Migration {
  from: string
  to: string
  migrate: (schema: unknown) => unknown
}
```

## 5. 核心接口

```ts
class MigrationRegistry {
  register(migration): void
  findPath(from, to): Migration[]
}

function migratePageSchema(schema, registry): PageSchema
```

## 6. 工业实现

注册表支持任意链式迁移；BFS 查找 from → 当前版本的路径；迁移完成后统一走 Zod 校验；缺少 version 或找不到路径时抛错。

## 7. 关键代码

```ts
const path = registry.findPath(version, SCHEMA_VERSION)
let current = schema
for (const migration of path) current = migration.migrate(current)
return parsePageSchema(current)
```

## 8. 调用链

```text
deserializePage → 版本识别 → 迁移链 → 校验 → 使用
```

## 9. 数据流

```text
旧 schema → 每次迁移 → 新 schema → Zod → 类型安全对象
```

## 10. 状态变化

- schema.version 提升；字段按迁移逻辑变换。

## 11. 模块协作

协议层（schema 包）统一负责校验与迁移，业务模块只认「当前版本」，从而允许协议演进而不破坏存量页面。

## 12. 扩展点

- 新版本：注册一条 Migration，路径查找自动衔接。

## 13. 面试表达

> Schema 版本化是低代码平台协议演进的安全网：每次协议变更注册一条 from→to 迁移，加载时按 BFS 找迁移链自动升级并校验，失败立即报错。这样编辑器、运行时和存量页面可以并行演进。
