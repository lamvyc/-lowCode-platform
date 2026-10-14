import type { MaterialRegistry } from '@lowcode/core'
import { LOCAL_MATERIALS } from './materials'

export { LOCAL_MATERIALS, MATERIAL_COMPONENTS } from './materials'
export { MATERIAL_MANIFESTS, type MaterialManifest } from './manifest'
export { createFormWidgetResolver } from './form'
export { useRuntimeContext } from './use-runtime'

// 容器
export { default as LcCard } from './components/Card.vue'
export { default as LcGrid } from './components/Grid.vue'
export { default as LcGridCol } from './components/GridCol.vue'
export { default as LcLayoutTable } from './components/LayoutTable.vue'
export { default as LcLayoutTableRow } from './components/LayoutTableRow.vue'
export { default as LcLayoutTableCell } from './components/LayoutTableCell.vue'
export { default as LcTab } from './components/Tab.vue'
export { default as LcTabPane } from './components/TabPane.vue'
// 基础
export { default as LcText } from './components/Text.vue'
export { default as LcStaticText } from './components/StaticText.vue'
export { default as LcHtmlText } from './components/HtmlText.vue'
export { default as LcButton } from './components/Button.vue'
export { default as LcDivider } from './components/Divider.vue'
export { default as LcImage } from './components/Image.vue'
// 表单字段
export { default as LcInput } from './components/Input.vue'
export { default as LcTextarea } from './components/Textarea.vue'
export { default as LcNumber } from './components/Number.vue'
export { default as LcRadio } from './components/Radio.vue'
export { default as LcCheckbox } from './components/Checkbox.vue'
export { default as LcSelect } from './components/Select.vue'
export { default as LcTime } from './components/Time.vue'
export { default as LcTimeRange } from './components/TimeRange.vue'
export { default as LcDate } from './components/Date.vue'
export { default as LcDateRange } from './components/DateRange.vue'
export { default as LcSwitch } from './components/Switch.vue'
export { default as LcRate } from './components/Rate.vue'
export { default as LcColor } from './components/Color.vue'
export { default as LcSlider } from './components/Slider.vue'
export { default as LcCascader } from './components/Cascader.vue'
// 高级字段
export { default as LcPictureUpload } from './components/PictureUpload.vue'
export { default as LcFileUpload } from './components/FileUpload.vue'
export { default as LcRichEditor } from './components/RichEditor.vue'
// 数据
export { default as LcTable } from './components/Table.vue'

/** 把全部本地物料注册进 MaterialRegistry */
export function registerLocalMaterials(registry: MaterialRegistry): void {
  registry.registerMany(LOCAL_MATERIALS)
}
