# Vue 3 企业级低代码平台

声明式 Schema 驱动的低代码平台基建：Schema → Core → Runtime → Editor 单向依赖，Core 纯 TS（无 Vue/DOM），覆盖统一 Schema 协议、渲染/表单/流程/规则/API 引擎、插件/连接器、权限与认证。

## 快速开始

```bash
corepack enable pnpm   # 首次
pnpm install
pnpm dev               # http://localhost:5173
pnpm test              # Vitest
pnpm typecheck
pnpm build
```

## 文档

- [架构总览](docs/architecture.md)
- [Schema 代码级走读](docs/schema-walkthrough.md)
- [五层架构企业级实践反推与基建优化](docs/五层架构企业级实践反推与基建优化.md)
