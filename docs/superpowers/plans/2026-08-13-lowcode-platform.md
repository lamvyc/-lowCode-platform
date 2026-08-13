# Vue 3 Low-Code Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, runnable Vue 3 enterprise low-code platform monorepo implementing the spec in `Vue 3 企业级低代码平台——场景驱动型工程实践 Agent 提示词.md`.

**Architecture:** pnpm workspace monorepo with strict dependency direction Schema → Core → Runtime → Editor. Core is pure TypeScript (no Vue/Pinia/DOM). Runtime is pure-TS Vue renderer consuming PageSchema. Editor is a Vue 3 + Pinia + Element Plus SFC source package consumed directly by the playground Vite app. Codegen produces Vue SFC via a small template AST + Prettier.

**Tech Stack:** TypeScript strict, pnpm workspace, Vitest, Vue 3, Pinia, Element Plus, Vite, Immer, Jexl, Zod, SortableJS/vuedraggable, Monaco Editor, Prettier.

> **写作规范（强制）：** 本项目生成的**所有文档**（`docs/**`、README 等）与**所有代码注释**一律使用**中文**撰写。英文仅允许出现在代码标识符、技术名词、外部库名称与命令行输出中。实施过程中新增/修改的任何文档和注释都必须遵守该规范。

---

## File Structure

```
/
├── package.json / pnpm-workspace.yaml / tsconfig.base.json / vitest.workspace.ts
├── docs/
│   ├── architecture.md
│   └── scenarios/  (10 core scenarios, fixed 13-point output format)
├── packages/
│   ├── schema/     @lowcode/schema  - types, zod validation, migration, serialize
│   ├── core/       @lowcode/core    - node-tree, material, expression, event/action,
│   │                                  datasource, rule, history, plugin, layout, drag-drop
│   ├── runtime/    @lowcode/runtime - RuntimeRenderer, RuntimeContext, renderer pipeline
│   ├── materials/  @lowcode/materials - local material registry (button/input/select/table/...)
│   ├── codegen/    @lowcode/codegen - template AST + prettier → Vue SFC
│   ├── editor/     @lowcode/editor  - Pinia store, canvas, material/props/outline panels, UX
│   └── playground/ @lowcode/playground - Vite app: page manager, editor, preview, versions
```

## Phase 0: Workspace Scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.gitignore`, `README.md`
- Create: `packages/<name>/package.json` + `tsconfig.json` + `tsconfig.build.json` + `vitest.config.ts` for schema, core, runtime, codegen
- Create: `packages/materials/package.json`, `packages/editor/package.json`, `packages/playground/package.json` (source exports, no build needed)

- [ ] Init git repo, install pnpm via corepack (`corepack enable pnpm`), run `pnpm install` (requires network escalation), `git init && git add -A && git commit`

## Phase 1: @lowcode/schema

**Files:** `packages/schema/src/types/*.ts` (page, node, binding, material, datasource, variable, rule, event, layout), `validation/*.ts` (zod), `migration/*.ts`, `serialize/*.ts`, `index.ts`

**Key interfaces:** `PageSchema`, `PageNode`, `Binding<T>`, `Material`, `PropConfig`, `DataSource`, `PageVariable`, `Rule`, `EventAction`, `ActionKind`, `LayoutPosition`, `parsePageSchema`, `serializePage`, `deserializePage`, `MigrationRegistry`, `migratePageSchema`.

- [ ] Write failing tests: zod accepts valid schema / rejects invalid; migration v1→v2 transforms and bumps version; serialize/deserialize round-trip
- [ ] Implement types + zod + migration + serializer
- [ ] `pnpm --filter @lowcode/schema test` green; commit

## Phase 2: @lowcode/core

**Files:**
- `node-tree.ts` — insert/remove/move/update/find/path/canMove (no moving into own descendants), immutable-ish tree ops
- `material/registry.ts` + `material/factory.ts` — MaterialRegistry, NodeFactory (defaultProps → PageNode)
- `expression/engine.ts` — IExpressionEngine, JexlExpressionEngine, ExpressionContext, FunctionRegistry (no eval/new Function)
- `drag-drop/manager.ts` — DragPayload, DropTarget, DropPosition, DragDropManager (pure geometry)
- `event/engine.ts` + `action/registry.ts` + `action/chain.ts` — EventEngine, ActionRegistry, ActionChainRunner (serial/async/conditional/error/interrupt)
- `datasource/manager.ts` — REST/static/localStorage/sessionStorage/pageVariable, loading/data/error state, subscribe
- `rule/engine.ts` — condition evaluation, effect execution, cooldown, cycle detection
- `history/manager.ts` — Immer patches, undo/redo/batch/merge/max-depth
- `plugin/manager.ts` + `plugin/hooks.ts` — Plugin, PluginAPI, HookBus (9 lifecycle hooks)
- `layout/grid.ts` — grid placement math (columns/rowHeight, drop → x/y/w/h)
- `data-bus.ts` — minimal typed emitter
- `index.ts`

**Tests (vitest, node):** each module with a `*.test.ts`; tests exercise the 10 core scenario behaviors end-to-end at core level (drag→insert, move legality, props update, expression eval, action chain, datasource load, rule triggers, undo/redo, plugin action, renderer-agnostic).

- [ ] Write failing tests for node-tree, material factory, expression, history first (red)
- [ ] Implement each module; run `pnpm --filter @lowcode/core test` green; commit

## Phase 3: @lowcode/runtime

**Files:** `context.ts` (RuntimeContext: reactive variables/datasource/dialogs, expression eval), `renderer.ts` (RuntimeRenderer defineComponent via `h()`, recursive, slots/loop/visible/events/style/props), `resolver.ts` (IComponentResolver via MaterialRegistry), `index.ts`

**Tests:** SSR smoke test with `vue/server-renderer` — render schema with a button material; assert markup contains text; loop/v-if expression cases.

- [ ] Failing SSR tests first; implement; `pnpm --filter @lowcode/runtime test` green; commit

## Phase 4: @lowcode/materials

**Files:** SFCs `Button.vue`, `Input.vue`, `Select.vue`, `Text.vue`, `Image.vue`, `Container.vue`, `Table.vue`, `Dialog.vue` + `index.ts` (registry with propConfigs, defaultProps, slots)

- [ ] Implement; wire into a local registry exported as `registerLocalMaterials`; no unit tests (covered by runtime SSR tests via a fake registry); commit

## Phase 5: @lowcode/codegen

**Files:** `ast.ts` (TemplateNode builder), `generator.ts` (ICodeGenerator: schema → SFC string via AST → Prettier), `index.ts`

**Tests:** generate SFC from a schema containing v-if/v-for/@click/:style and assert output contains them; output parses via `@vue/compiler-sfc` parse.

- [ ] Failing tests first; implement; green; commit

## Phase 6: @lowcode/editor

**Files:** `store/editor.ts` (schema/selected/hover/drag/zoom/clipboard/panels/preview + history integration), `components/*` (EditorShell, MaterialPanel, Canvas, CanvasNode, DropIndicator, PropsPanel, controls/*, OutlinePanel, Toolbar, ContextMenu, Preview), `composables/keyboard.ts`, `index.ts`

**Features:** drag material→canvas with drop indicator; move via drag in canvas/outline; props panel dynamic controls (Input/Select/Switch/Color/Number/Expression(Mono)/Event/JSON); binding editing; Ctrl+Z/Y, Ctrl+C/V, Delete, shift multi-select, lock, zoom, hover, context menu; plugin hooks on save.

- [ ] Implement; `pnpm --filter @lowcode/editor typecheck` green (vue-tsc); commit

## Phase 7: @lowcode/playground

**Files:** `index.html`, `main.ts`, `App.vue`, `views/*` (EditorView, PreviewView, PageManagerView), `demo-schema.ts`, `storage.ts` (pages + versions localStorage, auto/manual save, import/export JSON), `router.ts`

- [ ] Implement; `pnpm dev` runs; `pnpm build` green; commit

## Phase 8: Documentation

**Files:** `docs/architecture.md`, `docs/scenarios/01-drag-to-canvas.md` … `10-renderer.md` (+ codegen/migration), each following the fixed 13-point format from the spec.

- [ ] Write docs; commit

## Phase 9: Verification

- [ ] `pnpm -r test` — all packages green
- [ ] `pnpm -r typecheck` — clean
- [ ] `pnpm build` (playground production build) — exit 0
- [ ] Manual smoke: `pnpm dev` serves playground

## Self-Review Notes

- Spec coverage: all 10 core scenarios implemented; remote materials loader lives in core (ESM loader + cache/retry/fallback) but is not wired into editor UI (spec says implement later); editor UX subset implemented (keyboard, multi-select, lock, zoom, hover, context menu, drop indicator; lasso/auto-scroll/combine documented as future).
- Dependency direction enforced: core has no vue/pinia/element-plus imports; runtime has no editor imports; editor imports runtime+core.

> **更新（2026-08-14）：** 三个「后续能力」尾巴已补齐：
> - 远程物料加载器已实现并接入物料面板（演示 ESM 远程组件 + manifest URL 加载）；
> - 模板管理器已实现（保存/导入/导出/删除/一键建页）；
> - 编辑器框选批量选择与组合/取消组合已实现（Ctrl/Cmd+G）。
> 尚余规格书中未要求立即实现的部分：自动滚动、多选框选后的拖拽整体移动等纯体验项。
