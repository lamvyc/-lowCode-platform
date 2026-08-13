# 场景 3：配置组件属性

## 1. 场景

用户点击画布中的 Button，在右侧属性面板把文案从「按钮」改成「提交」。

## 2. 最终效果

画布中的 Button 文案实时变为「提交」，Ctrl+Z 可撤销。

## 3. 完整链路

```text
点击 Button → selectedNodeId → PropsPanel 读取 Material.propConfigs
  → 动态渲染控件（<component :is="..." />）
  → 用户输入 → updateProps
  → NodeTree.updateProps
  → History.record（mergeKey 合并连续输入）
  → PageSchema 更新 → Runtime Renderer → Button 文本变化
```

## 4. 核心数据结构

```ts
interface PropConfig {
  name: string
  label: string
  control: 'input' | 'number' | 'select' | 'switch' | 'color' | 'expression' | 'event' | 'json' | 'monaco' | 'slots'
  options?: { label: string; value: string }[]
  defaultValue?: unknown
}
```

## 5. 核心接口

```ts
store.updateProps(nodeId, patch)
store.updateNode(nodeId, updater)
store.updateBinding(nodeId, key, binding)
```

## 6. 工业实现

- 控件映射表 `CONTROL_COMPONENTS` + `<component :is>` 动态渲染。
- 每个属性支持「静态值 ↔ 表达式」切换（fx 按钮），对应 `Binding<T>` 两种形态。
- 连续输入通过 `mergeKey: props:<nodeId>` 在 800ms 窗口内合并为一条历史，避免一次输入产生几十条撤销记录。

## 7. 关键代码

```ts
updateProps(nodeId, patch) {
  this.commit((draft) => {
    new NodeTree(draft.nodes).updateProps(nodeId, patch)
  }, 'props', `props:${nodeId}`)
}
```

## 8. 调用链

```text
ElInput input → update:modelValue → setPropValue → store.updateProps → commit → History.record → schema 替换 → Renderer 重渲染
```

## 9. 数据流

```text
控件值 → patch → NodeTree.updateProps → Immer draft 修改 → 补丁入栈 → 新 schema → 渲染
```

## 10. 状态变化

- `node.props[name]` 更新。
- Pinia `schema` 引用替换（触发渲染）。
- History 栈（连续输入被合并）。

## 11. 模块协作

Material 提供 propConfigs（声明式），PropsPanel 只负责把配置翻译成控件；NodeTree 负责落数据；History 负责可撤销；Renderer 消费 schema。新增一种控件 = 注册一个新控件组件，不改其他模块。

## 12. 扩展点

- 新控件类型：实现一个 modelValue 双向组件并加入 `CONTROL_COMPONENTS`。
- 新物料属性：在 Material.propConfigs 加一行即可。

## 13. 面试表达

> 属性面板是「配置驱动的动态表单」：物料声明 propConfigs，面板用 `<component :is>` 按 control 类型渲染控件，输入直接写入 schema 节点 props。因为所有修改都走统一的 commit → History，连续输入还能按 mergeKey 合并撤销粒度。
