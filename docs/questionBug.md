# 问题记录

## question1：拖入根画布后组件名/拖拽手柄被遮挡

### 现象

从物料面板将组件拖入画布根节点（非拖入父组件）时，无论 PC、Pad 还是 H5 模式，组件的名字标签与拖拽手柄都会被遮挡或裁掉。

### 根因

根级组件直接放置在画布内容区中，而画布没有内部留白。组件名和拖拽手柄是溢出节点外部的浮层：

- 组件名定位在节点上方约 18px 处；
- 拖拽手柄定位在节点右上角，向上约 11px、向右约 11px；
- 选中节点的操作按钮定位在节点下方约 26px 处。

当根级组件贴着画布上边缘/右边缘时，这些浮层会超出画布裁剪区域，分别被工具栏、属性面板或 Pad/H5 的设备边框遮挡。子组件拖入父组件时因为有父容器的内边距/间距，所以不存在该问题。

### 修复

在 `packages/editor/src/designer/components/Canvas.vue` 中为 `.lc-canvas`（PC/Pad/H5 共用）增加内边距，为节点外浮层留出空间：

```css
.lc-canvas {
  background: #fff;
  box-sizing: border-box;
  /* 为节点外浮层（组件名/拖拽手柄等）留出空间，避免贴边被画布裁剪 */
  padding: 24px;
}
```

### 验证

- 无头 Chrome 分别在 PC / Pad / H5 下复现“从物料面板拖入空根画布”：修复前组件名与拖拽手柄均超出画布范围，修复后均完整位于画布内。
- `pnpm --filter @lowcode/editor test`：17 个测试全部通过。
- `pnpm --filter @lowcode/editor typecheck`：通过。
