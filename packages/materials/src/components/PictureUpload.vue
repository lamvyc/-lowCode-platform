<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElUpload } from 'element-plus'
import type { UploadFile, UploadRawFile, UploadRequestOptions, UploadUserFile } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcPictureUpload' })

/** 对外暴露的文件项结构（与设计器/运行时约定的字段保持一致） */
interface PictureFile {
  name?: string
  url: string
}

const props = withDefaults(
  defineProps<{
    /** 字段标签 */
    label?: string
    /** 标签宽度（px）；为空时按内容自适应 */
    labelWidth?: number | null
    /** 是否隐藏标签 */
    labelHidden?: boolean
    /** 标签对齐方式 */
    labelAlign?: 'left' | 'center' | 'right'
    /** 标签图标 class（如 el-icon-user） */
    labelIconClass?: string
    /** 标签图标位置：前置 / 后置 */
    labelIconPosition?: 'front' | 'rear'
    /** 标签悬浮提示 */
    labelTooltip?: string
    /** 是否必填 */
    required?: boolean
    /** 必填提示 */
    requiredHint?: string
    /** 校验提示 */
    validationHint?: string
    /** 控件区域宽度，如 '200px' */
    columnWidth?: string
    /** 自定义校验提示；validationHint 为空时作为校验提示展示 */
    customRuleHint?: string
    /** 文件列表（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: PictureFile[]
    disabled?: boolean
    /** 上传地址；为空时只生成本地预览，不发起真实请求 */
    uploadURL?: string
    /** 上传说明文案 */
    uploadTip?: string
    /** 上传时是否携带 cookie */
    withCredentials?: boolean
    /** 是否允许一次选择多个文件 */
    multipleSelect?: boolean
    /** 是否展示已选文件列表 */
    showFileList?: boolean
    /** 最多可上传数量 */
    limit?: number
    /** 单个文件大小上限（MB） */
    fileMaxSize?: number
    /** 允许的文件扩展名（不含点） */
    fileTypes?: string[]
  }>(),
  {
    label: '',
    labelWidth: null,
    labelHidden: false,
    labelAlign: 'left',
    required: false,
    requiredHint: '',
    validationHint: '',
    columnWidth: '',
    customRuleHint: '',
    modelValue: () => [],
    disabled: false,
    uploadURL: '',
    uploadTip: '',
    withCredentials: false,
    multipleSelect: false,
    showFileList: true,
    limit: 3,
    fileMaxSize: 5,
    fileTypes: () => ['jpg', 'jpeg', 'png'],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: PictureFile[]): void
  (e: 'uploadSuccess', response: unknown, file: UploadFile): void
  (e: 'uploadError', error: Error, file: UploadFile): void
  (e: 'fileRemove', file: UploadFile): void
  (e: 'beforeUpload', file: UploadRawFile): void
}>()

/** 校验提示：自定义规则提示作为兜底 */
const hintText = computed(() => props.validationHint || props.customRuleHint)

const allowedTypes = computed(() =>
  Array.isArray(props.fileTypes) ? props.fileTypes.map((item) => String(item).toLowerCase()) : [],
)

/** 支持类型/大小说明 */
const ruleTipText = computed(() => {
  const typeText = allowedTypes.value.length > 0 ? allowedTypes.value.join(' / ') : '不限'
  const sizeText = props.fileMaxSize > 0 ? `，单个文件不超过 ${props.fileMaxSize}MB` : ''
  return `支持 ${typeText} 格式${sizeText}`
})

/** 把外部数据规整为 ElUpload 需要的文件列表 */
const toFileList = (value: PictureFile[] | undefined | null): UploadUserFile[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    name: item?.name || item?.url || '',
    url: item?.url || '',
  }))
}

const fileList = ref<UploadUserFile[]>(toFileList(props.modelValue))

/** 仅在外部数据与当前列表不一致时回写，避免打断正在进行的上传 */
watch(
  () => props.modelValue,
  (value) => {
    const next = toFileList(value)
    const same =
      next.length === fileList.value.length &&
      next.every(
        (item, index) =>
          item.url === fileList.value[index].url && item.name === fileList.value[index].name,
      )
    if (!same) fileList.value = next
  },
  { deep: true },
)

const syncModelValue = () => {
  emit(
    'update:modelValue',
    fileList.value.map((item) => ({ name: item.name, url: item.url ?? '' })),
  )
}

/** 从上传响应里兜底取预览地址（本地预览时响应即 { name, url }） */
const pickResponseURL = (response: unknown): string => {
  if (response && typeof response === 'object' && 'url' in response) {
    const url = (response as { url?: unknown }).url
    if (typeof url === 'string') return url
  }
  return ''
}

/** 以 ElUpload 内部列表为准回写，保证 uid/status 等运行时字段不丢失 */
const syncFromUploadFiles = (files: UploadFile[]) => {
  fileList.value = files.map((item) => ({
    name: item.name,
    url: item.url || pickResponseURL(item.response),
    uid: item.uid,
    status: item.status,
    raw: item.raw,
    response: item.response,
  }))
  syncModelValue()
}

/** 取小写扩展名（不含点） */
const getExtension = (name: string): string => {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index + 1).toLowerCase()
}

const handleBeforeUpload = (rawFile: UploadRawFile) => {
  if (allowedTypes.value.length > 0 && !allowedTypes.value.includes(getExtension(rawFile.name))) {
    ElMessage.error(`只支持 ${allowedTypes.value.join(' / ')} 格式的文件`)
    return false
  }
  if (props.fileMaxSize > 0 && rawFile.size / 1024 / 1024 > props.fileMaxSize) {
    ElMessage.error(`文件大小不能超过 ${props.fileMaxSize}MB`)
    return false
  }
  emit('beforeUpload', rawFile)
  return true
}

const handleHttpRequest = (options: UploadRequestOptions): Promise<unknown> => {
  if (!props.uploadURL) {
    // 未配置上传地址：生成本地对象 URL 作为预览地址，不发起真实请求
    let url = ''
    try {
      url = URL.createObjectURL(options.file)
    } catch {
      url = ''
    }
    return Promise.resolve({ name: options.file.name, url } as PictureFile)
  }
  // 已配置上传地址：用 XMLHttpRequest 上传，便于透传 withCredentials
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', props.uploadURL, true)
    xhr.withCredentials = props.withCredentials
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let data: unknown = xhr.responseText
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          // 非 JSON 响应按纯文本处理
        }
        resolve(data)
      } else {
        reject(new Error(`上传失败：${xhr.status} ${xhr.statusText}`))
      }
    }
    xhr.onerror = () => reject(new Error('上传失败：网络异常'))
    const formData = new FormData()
    formData.append(options.filename || 'file', options.file)
    xhr.send(formData)
  })
}

const handleSuccess = (response: unknown, file: UploadFile, files: UploadFile[]) => {
  emit('uploadSuccess', response, file)
  syncFromUploadFiles(files)
}

const handleError = (error: Error, file: UploadFile, files: UploadFile[]) => {
  emit('uploadError', error, file)
  syncFromUploadFiles(files)
}

const handleRemove = (file: UploadFile, files: UploadFile[]) => {
  emit('fileRemove', file)
  syncFromUploadFiles(files)
}
</script>

<template>
  <FormItem
    :label="label"
    :label-width="labelWidth"
    :label-hidden="labelHidden"
    :label-align="labelAlign"
    :label-icon-class="labelIconClass"
    :label-icon-position="labelIconPosition"
    :label-tooltip="labelTooltip"
    :required="required"
    :required-hint="requiredHint"
    :validation-hint="hintText"
    :column-width="columnWidth"
  >
    <ElUpload
      list-type="picture-card"
      class="lc-picture-upload"
      :file-list="fileList"
      :limit="limit"
      :disabled="disabled"
      :show-file-list="showFileList"
      :multiple="multipleSelect"
      :with-credentials="withCredentials"
      :http-request="handleHttpRequest"
      :before-upload="handleBeforeUpload"
      :on-success="handleSuccess"
      :on-error="handleError"
      :on-remove="handleRemove"
    >
      <div class="lc-picture-upload__trigger">+</div>
    </ElUpload>
    <p v-if="uploadTip" class="lc-upload__tip">{{ uploadTip }}</p>
    <p class="lc-upload__tip">{{ ruleTipText }}</p>
  </FormItem>
</template>

<style scoped>
.lc-picture-upload__trigger {
  font-size: 24px;
  line-height: 1;
  color: #8c939d;
}
.lc-upload__tip {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 16px;
  color: #86909c;
}
</style>
