# Vue 3 企业级低代码平台

声明式 Schema 驱动的低代码平台基建：Schema → Core → Runtime → Editor 单向依赖，Core 纯 TS（无 Vue/DOM），覆盖统一 Schema 协议、渲染/表单/流程/规则/API 引擎、插件/连接器、权限与认证。

## 快速开始

```bash
corepack enable pnpm   # 首次
pnpm install
pnpm test              # Vitest（含一致性审计与上游样式审计）
pnpm typecheck
pnpm build
```

真机验收（覆盖 happy-dom 到不了的那层：真实布局、真实鼠标/拖拽事件）：

```bash
pnpm dev               # 启动 playground；端口以输出为准（5173 被占用时会自动换）
# 另开一个终端，用上面输出的地址
pnpm verify:browser -- --url http://localhost:5173/
```

⚠️ 不指定 `--url` 时若检测到多个 dev server，脚本会**拒绝执行**——猜错端口会拿旧代码当验收对象。
详见 [真机验收套件](docs/browser-checks.md)。

## 文档

- [架构总览](docs/architecture.md)
- [Schema 代码级走读](docs/schema-walkthrough.md)
- [设计器界面（导航栏 / 组件库 / 页面模板 / 结构树 / 生成 SFC）](docs/designer-ui.md)
- [组件库（物料清单与移植说明）](docs/material-library.md)
- [组件库一致性基线（自动比对参考实现）](docs/conformance.md)
- [上游样式差异报告（Element UI → Element Plus，自动生成）](docs/upstream-diff-report.md)
- [真机验收套件（只有真实浏览器能覆盖的那层）](docs/browser-checks.md)
- [物料面板 A/B 对比（与参考实现实测对齐）](docs/palette-diff.md)
- [画布级 A/B 对比（骨架 / 画布结构 / 渲染实测）](docs/canvas-ab.md)
- [组件交互设计报告（参考实现的行为面规格）](docs/interaction-spec/README.md) —— 一致性基线只覆盖声明面，这里是行为面
- [设置面板（组件设置 / 表单设置）](docs/setting-panel.md)
- [五层架构企业级实践反推与基建优化](docs/五层架构企业级实践反推与基建优化.md)
