# 纯基建临界点设计

## 目标

把仓库清理到「绝对有效基建」基线：保留协议、核心引擎、渲染器、物料和可复用的纯逻辑，移除旧页面构建器交互层，使后续任何页面构建器实现都可以从该基线重新开始。

## 保留边界

- `@lowcode/schema`：页面协议、Zod 校验、迁移、序列化。
- `@lowcode/core`：节点树、表达式、动作链、数据源、历史、插件、布局、拖拽计算、远程物料。
- `@lowcode/runtime`：运行时上下文和纯 `h()` 渲染器。
- `@lowcode/materials`：本地物料声明与 SFC。
- `@lowcode/codegen`：模板 AST 与生成器，作为独立基建保留。
- `@lowcode/editor`：仅保留 `platform.ts` 和 `engine/*`，不再包含 Vue 编辑器 UI。
- `@lowcode/playground`：仅作为运行时验证壳和存储仓储测试载体，不再包含页面管理、旧编辑器、旧预览 UI。

## 删除边界

- `editor/src/components/**`
- `editor/src/composables/**`
- `editor/src/store/editor.ts`
- `editor/src/editor-keys.ts`
- `editor/src/styles.css`
- `editor/src/demo-remote-*`
- `playground/src/views/**`
- `playground/src/router.ts`
- `playground/src/plugins.ts`
- 旧页面管理、编辑器、预览 UI

## 验证标准

1. `pnpm -r test` 全绿。
2. `pnpm -r typecheck` 全绿。
3. `pnpm --filter @lowcode/playground build` 成功。
4. 编辑器包导出仅包含平台单例和纯引擎 API。

## 后续重建原则

新页面构建器只能依赖 `EditorEngine`、`NodeTree`、`RuntimeRenderer` 和物料注册表；交互层必须与核心逻辑分离，并优先用纯函数测试锁定行为。
