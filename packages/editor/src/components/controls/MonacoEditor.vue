<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    language?: string
    height?: number
    readonly?: boolean
  }>(),
  {
    modelValue: '',
    language: 'javascript',
    height: 120,
    readonly: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

/** 配置 Monaco 的 Web Worker（Vite ?worker 语法） */
function setupWorkers() {
  ;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker: (_workerId: string, label: string) => {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    },
  }
}

onMounted(() => {
  setupWorkers()
  if (!container.value) return
  editor.value = monaco.editor.create(container.value, {
    value: props.modelValue ?? '',
    language: props.language,
    theme: 'vs',
    minimap: { enabled: false },
    fontSize: 13,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    readOnly: props.readonly,
  })
  editor.value.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.value?.getValue() ?? '')
  })
})

watch(
  () => props.modelValue,
  (value) => {
    const current = editor.value
    if (current && value !== current.getValue()) {
      current.setValue(value ?? '')
    }
  },
)

onBeforeUnmount(() => {
  editor.value?.dispose()
})
</script>

<template>
  <div
    ref="container"
    :style="{
      height: `${height}px`,
      border: '1px solid #e5e6eb',
      borderRadius: '4px',
      overflow: 'hidden',
    }"
  />
</template>
