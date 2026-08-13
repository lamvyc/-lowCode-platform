/**
 * 演示用远程物料组件：刻意不 import vue，
 * 通过 render(h) 的 h 参数实现，模拟真正的远程 ESM 包。
 */
export default {
  name: 'RemoteWidget',
  props: {
    text: { type: String, default: '远程物料' },
    color: { type: String, default: '#722ed1' },
  },
  render(
    this: Record<string, unknown>,
    h: (tag: string, props?: Record<string, unknown>, children?: unknown) => unknown,
  ) {
    return h(
      'div',
      {
        style: {
          border: '1px dashed #722ed1',
          borderRadius: '6px',
          padding: '12px',
          color: this.color,
          background: '#f9f0ff',
        },
      },
      `[远程物料] ${String(this.text)}`,
    )
  },
}
