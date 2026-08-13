import './styles.css'

export { default as EditorShell } from './components/EditorShell.vue'
export { useEditorStore, type DragState, type ContextMenuState } from './store/editor'
export {
  initPlatform,
  registerPlugin,
  materialRegistry,
  actionRegistry,
  expressionEngine,
  pluginManager,
} from './platform'
