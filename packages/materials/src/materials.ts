import type { Component } from 'vue'
import type { Material } from '@lowcode/schema'
import { MATERIAL_MANIFESTS, type MaterialManifest } from './manifest'
import LcText from './components/Text.vue'
import LcStaticText from './components/StaticText.vue'
import LcHtmlText from './components/HtmlText.vue'
import LcButton from './components/Button.vue'
import LcDivider from './components/Divider.vue'
import LcInput from './components/Input.vue'
import LcTextarea from './components/Textarea.vue'
import LcNumber from './components/Number.vue'
import LcRadio from './components/Radio.vue'
import LcCheckbox from './components/Checkbox.vue'
import LcSelect from './components/Select.vue'
import LcTime from './components/Time.vue'
import LcTimeRange from './components/TimeRange.vue'
import LcDate from './components/Date.vue'
import LcDateRange from './components/DateRange.vue'
import LcSwitch from './components/Switch.vue'
import LcRate from './components/Rate.vue'
import LcColor from './components/Color.vue'
import LcSlider from './components/Slider.vue'
import LcCascader from './components/Cascader.vue'
import LcPictureUpload from './components/PictureUpload.vue'
import LcFileUpload from './components/FileUpload.vue'
import LcRichEditor from './components/RichEditor.vue'
import LcImage from './components/Image.vue'
import LcTable from './components/Table.vue'
import LcAlert from './components/Alert.vue'
import LcCard from './components/Card.vue'
import LcGrid from './components/Grid.vue'
import LcGridCol from './components/GridCol.vue'
import LcLayoutTable from './components/LayoutTable.vue'
import LcLayoutTableRow from './components/LayoutTableRow.vue'
import LcLayoutTableCell from './components/LayoutTableCell.vue'
import LcTab from './components/Tab.vue'
import LcTabPane from './components/TabPane.vue'

/** 物料 type → Vue 组件实现 */
export const MATERIAL_COMPONENTS: Record<string, Component> = {
  // 容器
  card: LcCard,
  grid: LcGrid,
  'grid-col': LcGridCol,
  'layout-table': LcLayoutTable,
  'layout-table-row': LcLayoutTableRow,
  'layout-table-cell': LcLayoutTableCell,
  tab: LcTab,
  'tab-pane': LcTabPane,
  // 基础
  text: LcText,
  'static-text': LcStaticText,
  'html-text': LcHtmlText,
  button: LcButton,
  divider: LcDivider,
  image: LcImage,
  // 自定义扩展字段
  alert: LcAlert,
  // 表单字段
  input: LcInput,
  textarea: LcTextarea,
  number: LcNumber,
  radio: LcRadio,
  checkbox: LcCheckbox,
  select: LcSelect,
  time: LcTime,
  'time-range': LcTimeRange,
  date: LcDate,
  'date-range': LcDateRange,
  switch: LcSwitch,
  rate: LcRate,
  color: LcColor,
  slider: LcSlider,
  cascader: LcCascader,
  // 高级字段
  'picture-upload': LcPictureUpload,
  'file-upload': LcFileUpload,
  'rich-editor': LcRichEditor,
  // 数据
  table: LcTable,
}

/** 本地物料清单：清单声明（manifest）与组件实现合并 */
export const LOCAL_MATERIALS: Material[] = MATERIAL_MANIFESTS.map(
  (manifest: MaterialManifest): Material => {
    const component = MATERIAL_COMPONENTS[manifest.type]
    if (!component) {
      throw new Error(`物料缺少组件实现: ${manifest.type}`)
    }
    return { ...manifest, component }
  },
)

export { MATERIAL_MANIFESTS, type MaterialManifest }
