<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElInput } from 'element-plus'
import FormItem from './FormItem.vue'

defineOptions({ name: 'LcInput' })

const props = withDefaults(
  defineProps<{
    /**
     * 生命周期钩子（与参考实现一致）。
     * ⚠️ 组件**自己不用**这两项，是由运行时在创建/挂载时执行；
     *    但必须在这里声明，否则它们会变成透传的 HTML 属性出现在 DOM 上。
     */
    onCreated?: string
    onValidate?: string
    onMounted?: string
    /** 字段标签 */
    label?: string
    labelWidth?: number | null
    labelHidden?: boolean
    labelAlign?: 'left' | 'center' | 'right'
    /** 标签图标 class（如 el-icon-user） */
    labelIconClass?: string
    /** 标签图标位置：前置 / 后置 */
    labelIconPosition?: 'front' | 'rear'
    /** 标签悬浮提示 */
    labelTooltip?: string
    required?: boolean
    requiredHint?: string
    validationHint?: string
    columnWidth?: string
    /** 输入类型：单行文本 / 密码 / 多行文本 / 数字（数字见 inputType 的说明） */
    type?: 'text' | 'password' | 'textarea' | 'number'
    /** 字段值（设计器里作为「默认值」，运行时为实时值） */
    modelValue?: string
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    readonly?: boolean
    showPassword?: boolean
    size?: '' | 'large' | 'default' | 'small'
    minLength?: number | null
    maxLength?: number | null
    showWordLimit?: boolean
    prefixIcon?: string
    suffixIcon?: string
    appendButton?: boolean
    appendButtonDisabled?: boolean
    buttonIcon?: string
    /** textarea 行数 */
    rows?: number
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
    type: 'text',
    modelValue: '',
    placeholder: '',
    clearable: true,
    disabled: false,
    readonly: false,
    showPassword: false,
    size: '',
    minLength: null,
    maxLength: null,
    showWordLimit: false,
    prefixIcon: '',
    suffixIcon: '',
    appendButton: false,
    appendButtonDisabled: false,
    buttonIcon: '',
    rows: 3,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'input', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'appendButtonClick'): void
}>()

const sizeProp = computed(() => (props.size === '' ? undefined : props.size))

/**
 * 渲染用的 input 类型。
 *
 * `number` 被**有意屏蔽为 `text`**——这是参考实现的既有取舍，不要"修正"：
 * 若真用原生 `type="number"`，用户输入非数字字符时 `v-model` 拿到的是空字符串，
 * 非法输入被浏览器直接吞掉，导致 `validation: 'number'` 之类的格式校验**永远拿不到值、给不出提示**。
 * 屏蔽为 text 后非法内容会留在输入框里，交给校验层报错。
 *
 * 参考：variant-form `input-widget.vue:71-78`。
 */
const inputType = computed(() => (props.type === 'number' ? 'text' : props.type))

const modelText = computed(() => {
  const value = props.modelValue
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
})

const maxLength = computed(() => (props.maxLength && props.maxLength > 0 ? props.maxLength : undefined))
const minLength = computed(() => (props.minLength && props.minLength > 0 ? props.minLength : undefined))
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
    :validation-hint="validationHint"
    :column-width="columnWidth"
  >
    <ElInput
      :model-value="modelText"
      :type="inputType"
      :size="sizeProp"
      :placeholder="placeholder"
      :clearable="clearable"
      :disabled="disabled"
      :readonly="readonly"
      :show-password="showPassword && type === 'password'"
      :minlength="minLength"
      :maxlength="maxLength"
      :show-word-limit="showWordLimit && Boolean(maxLength)"
      :prefix-icon="prefixIcon || undefined"
      :suffix-icon="suffixIcon || undefined"
      :rows="type === 'textarea' ? rows : undefined"
      @update:model-value="emit('update:modelValue', $event)"
      @input="emit('input', $event)"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    >
      <template v-if="appendButton" #append>
        <ElButton
          :icon="buttonIcon || undefined"
          :disabled="disabled || appendButtonDisabled"
          @click="emit('appendButtonClick')"
        />
      </template>
    </ElInput>
  </FormItem>
</template>
