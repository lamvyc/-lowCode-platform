import type { RemoteMaterialManifest } from '@lowcode/schema'

/** 演示远程物料清单：URL 指向同包内的演示组件源码（开发模式由 Vite 提供） */
export const demoRemoteManifest: RemoteMaterialManifest = {
  type: 'remote-widget',
  name: '远程徽章',
  category: '远程',
  icon: '◎',
  description: '演示 ESM 远程物料加载',
  version: '1.0.0',
  url: new URL('./demo-remote-widget.ts', import.meta.url).href,
  format: 'esm',
  defaultProps: { text: '远程物料', color: '#722ed1' },
  propConfigs: [
    { name: 'text', label: '文案', control: 'input', defaultValue: '远程物料' },
    { name: 'color', label: '颜色', control: 'color', defaultValue: '#722ed1' },
  ],
}
