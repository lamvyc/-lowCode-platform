import type { MaterialRegistry } from '@lowcode/core'
import { LOCAL_MATERIALS } from './materials'

export { LOCAL_MATERIALS } from './materials'
export { createFormWidgetResolver } from './form'
export { useRuntimeContext } from './use-runtime'
export { default as LcText } from './components/Text.vue'
export { default as LcButton } from './components/Button.vue'
export { default as LcInput } from './components/Input.vue'
export { default as LcSelect } from './components/Select.vue'
export { default as LcImage } from './components/Image.vue'
export { default as LcContainer } from './components/Container.vue'
export { default as LcTable } from './components/Table.vue'
export { default as LcDialog } from './components/Dialog.vue'

/** 把全部本地物料注册进 MaterialRegistry */
export function registerLocalMaterials(registry: MaterialRegistry): void {
  registry.registerMany(LOCAL_MATERIALS)
}
