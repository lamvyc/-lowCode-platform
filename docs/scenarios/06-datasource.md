# 场景 6：数据源驱动页面

## 1. 场景

页面加载后自动请求用户列表，Table 无需任何额外代码直接显示数据。

## 2. 最终效果

进入页面后 Table 自动填充数据；请求期间有 loading 状态，失败有 error 状态。

## 3. 完整链路

```text
RuntimeContext.init
  → DataSourceManager.loadAll
  → HTTP / 静态 / 存储
  → 状态: loading → success/error
  → 状态通知（listeners）
  → RuntimeContext.buildExpressionContext（datasource 作用域）
  → Table.props.data 表达式 $datasource.userList.data
  → Vue 更新
```

## 4. 核心数据结构

```ts
interface DataSource {
  id: string
  name: string
  type: 'rest' | 'static' | 'localStorage' | 'sessionStorage' | 'pageVariable'
  config: { url?; method?; params?; headers?; staticData?; storageKey?; variableId?; pollInterval? }
  autoLoad?: boolean
}

interface DataSourceState {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: unknown
  error?: string
}
```

## 5. 核心接口

```ts
class DataSourceManager {
  register(source): void
  load(id, params?): Promise<unknown>
  loadAll(): Promise<void>
  setData(id, data): void
  getData(id): unknown
  onStateChange(listener): () => void
}
```

## 6. 工业实现

- HTTP 通过注入的 `HttpClient` 适配（默认提供 fetch 实现），Core 不直接依赖 DOM。
- 存储通过 `StorageLike` 注入，测试用 `MemoryStorage`。
- 支持轮询（pollInterval），状态变更广播给监听者。

## 7. 关键代码

```ts
async load(id, params?) {
  this.setState(id, { status: 'loading', data: undefined })
  try {
    const data = await this.fetch(source, params)
    this.setState(id, { status: 'success', data, updatedAt: Date.now() })
    return data
  } catch (error) {
    this.setState(id, { status: 'error', data: undefined, error: message })
    throw error
  }
}
```

## 8. 调用链

```text
init → loadAll → fetch → setState → listener → buildExpressionContext → resolveProp → 渲染
```

## 9. 数据流

```text
请求配置 → 响应 → DataSourceState → datasource 作用域 → 表达式 → props → UI
```

## 10. 状态变化

- `DataSourceManager.states[id]`：loading → success / error。

## 11. 模块协作

DataSourceManager 统一管理数据生命周期；RuntimeContext 把数据快照放入表达式上下文；Renderer 通过表达式消费数据。任何组件都可以通过 `$datasource.<id>.data` 绑定同一份数据。

## 12. 扩展点

- 新数据源类型：在 `fetch()` 的 switch 中增加分支。
- 新请求库：实现并注入新的 `HttpClient`。

## 13. 面试表达

> 数据源驱动页面的关键是「状态集中 + 表达式消费」：DataSourceManager 统一管理 loading/data/error，数据变化广播给 RuntimeContext，组件用 `$datasource.userList.data` 这类表达式声明式绑定，因此表格、下拉、图表可以共享同一数据源而互不感知。
