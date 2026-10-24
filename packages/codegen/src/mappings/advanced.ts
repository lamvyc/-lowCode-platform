import { el, type TemplateNode } from '../ast'
import { isExpressionBinding, type PageNode } from '@lowcode/schema'
import { rewriteExpression } from '../expressions'
import { sanitizeIdentifier } from '../plan'
import { bindAttr, boolAttr, staticAttr } from './helpers'
import type { MappingContext, MappingRegistry } from './types'

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function tableAttrs(node: PageNode, ctx: MappingContext): Record<string, string | true> {
  const attrs: Record<string, string | true> = {}
  const data = node.props.data
  if (isExpressionBinding(data)) {
    attrs[':data'] = rewriteExpression(data.value, ctx.datasourceIds, ctx.variableNames, 'template')
  } else if (data !== undefined) {
    attrs[':data'] = JSON.stringify(data)
  }
  Object.assign(attrs, boolAttr('stripe', node.props.stripe === true))
  Object.assign(attrs, boolAttr('border', node.props.border !== false))
  return attrs
}

function columnNodes(node: PageNode): TemplateNode[] {
  const columns = Array.isArray(node.props.columns) ? node.props.columns : []
  return columns.map((column) => {
    const config = column as Record<string, unknown>
    const attrs: Record<string, string | true> = {
      prop: str(config.prop),
      label: str(config.label),
    }
    if (config.width !== undefined && config.width !== null && config.width !== '') {
      attrs.width = str(config.width)
    }
    return el('el-table-column', attrs, [])
  })
}

/** P1 高级物料：数据表格（上传/富文本在后续任务追加） */
export function registerAdvancedMappings(registry: MappingRegistry): void {
  registry.register('data-table', {
    tag: 'el-table',
    attrs: (node, ctx) => tableAttrs(node, ctx),
    render: (node, ctx) => el('el-table', tableAttrs(node, ctx), columnNodes(node)),
  })

  registry.register('picture-upload', uploadFactory(true))
  registry.register('file-upload', uploadFactory(false))

  registry.register('rich-editor', {
    tag: 'QuillEditor',
    field: true,
    model: 'content',
    initialValue: () => '',
    imports: [{ name: 'QuillEditor', from: '@vueup/vue-quill' }],
    sideEffectImports: ['@vueup/vue-quill/dist/vue-quill.snow.css'],
    attrs: (node) => {
      const attrs: Record<string, string | true> = {
        'content-type': 'html',
        theme: 'snow',
        toolbar: 'full',
      }
      Object.assign(attrs, staticAttr('placeholder', node.props.placeholder))
      Object.assign(attrs, bindAttr('read-only', String(node.props.disabled === true)))
      return attrs
    },
  })
}

/** 上传组件共用的生成逻辑 */
function uploadFactory(picture: boolean): Parameters<MappingRegistry['register']>[1] {
  return {
    tag: 'el-upload',
    field: true,
    model: 'none',
    imports: [{ name: 'ElMessage', from: 'element-plus' }],
    initialValue: () => [],
    attrs: (node, ctx) => {
      const suffix = sanitizeIdentifier(node.id, 'upload')
      const attrs: Record<string, string | true> = {
        ':file-list': `${ctx.form.modelName}.${ctx.modelKey(node)}`,
        ':auto-upload': node.props.uploadURL ? 'true' : 'false',
        ':show-file-list': node.props.showFileList === false ? 'false' : 'true',
        ':multiple': node.props.multipleSelect === true ? 'true' : 'false',
        ':with-credentials': node.props.withCredentials === true ? 'true' : 'false',
        ':before-upload': `beforeUpload_${suffix}`,
        ':on-success': `onUploadSuccess_${suffix}`,
        ':on-error': `onUploadError_${suffix}`,
        ':on-remove': `onRemove_${suffix}`,
      }
      const limit = typeof node.props.limit === 'number' ? node.props.limit : 3
      if (limit > 0) attrs[':limit'] = String(limit)
      if (picture) attrs['list-type'] = 'picture-card'
      const uploadURL = str(node.props.uploadURL)
      if (uploadURL !== '') attrs.action = uploadURL
      else attrs[':on-change'] = `onChange_${suffix}`
      const fileTypes = Array.isArray(node.props.fileTypes) ? node.props.fileTypes : []
      if (fileTypes.length > 0) attrs.accept = fileTypes.map((type) => `.${str(type)}`).join(',')
      return attrs
    },
    setup: (node, ctx) => {
      const suffix = sanitizeIdentifier(node.id, 'upload')
      const model = `${ctx.form.modelName}.${ctx.modelKey(node)}`
      const maxSize = typeof node.props.fileMaxSize === 'number' ? node.props.fileMaxSize : 5
      const fileTypes = Array.isArray(node.props.fileTypes) ? node.props.fileTypes.map((t) => str(t)) : []
      const hasRemote = str(node.props.uploadURL) !== ''
      return [
        `function beforeUpload_${suffix}(file) {`,
        `  if (file.size > ${maxSize} * 1024 * 1024) {`,
        `    ElMessage.error('文件大小不能超过 ${maxSize}MB')`,
        `    return false`,
        `  }`,
        ...(fileTypes.length > 0
          ? [
              `  const allowed = ${JSON.stringify(fileTypes)}`,
              `  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || ''`,
              `  if (!allowed.includes(ext)) {`,
              `    ElMessage.error('文件类型不支持：' + ext)`,
              `    return false`,
              `  }`,
            ]
          : []),
        `  return true`,
        `}`,
        `function onUploadSuccess_${suffix}(response, file) {`,
        `  const url = response?.url || response?.data?.url || file?.url || ''`,
        `  const list = Array.isArray(${model}) ? ${model} : []`,
        `  ${model} = [...list, { name: file?.name || '', url }]`,
        `}`,
        `function onUploadError_${suffix}(error) {`,
        `  ElMessage.error('上传失败：' + (error?.message || error))`,
        `}`,
        `function onRemove_${suffix}(file) {`,
        `  const list = Array.isArray(${model}) ? ${model} : []`,
        `  ${model} = list.filter((item) => item && item.url !== file.url && item.name !== file.name)`,
        `}`,
        ...(hasRemote
          ? []
          : [
              `function onChange_${suffix}(file) {`,
              `  if (!file || file.status !== 'ready' || !file.raw) return`,
              `  const url = URL.createObjectURL(file.raw)`,
              `  const list = Array.isArray(${model}) ? ${model} : []`,
              `  ${model} = [...list, { name: file.name, url }]`,
              `}`,
            ]),
      ]
    },
  }
}
