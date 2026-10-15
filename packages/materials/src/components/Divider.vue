<script setup lang="ts">
import { ElDivider } from 'element-plus'

defineOptions({ name: 'LcDivider' })

withDefaults(
  defineProps<{
    /** 分割线文案 */
    label?: string
    /** 分割线方向 */
    direction?: 'horizontal' | 'vertical'
    /** 文案位置 */
    contentPosition?: 'left' | 'center' | 'right'
  }>(),
  {
    label: '',
    direction: 'horizontal',
    contentPosition: 'center',
  },
)
</script>

<template>
  <ElDivider
    class="lc-divider"
    :direction="direction"
    :content-position="contentPosition"
  >
    {{ label }}
  </ElDivider>
</template>

<style scoped>
/**
 * 去掉 Element 给 `.el-divider--horizontal` 的 `margin: 24px 0`。
 *
 * 参考实现是在它的两个包裹层（`form-item-wrapper.vue` / `static-content-wrapper.vue`）
 * 里用 scoped 规则 `.el-divider--horizontal { margin: 0 }` 压掉的——
 * 实测参考画布上的 divider computed margin 就是 `0px 0px 0px 0px`，
 * 而我们此前是 `24px 0px 24px 0px`（多了上下各 24px）。
 *
 * 注意本组件在画布上不属于 `.lc-form-item`（静态内容没有表单项外壳），
 * 所以这条规则必须落在组件自己身上，不能指望表单项的样式覆盖到。
 */
.lc-divider :deep(.el-divider--horizontal) {
  margin: 0;
}
</style>
