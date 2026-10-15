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
/*
 * ⚠️ 必须用**复合选择器**，不能写 `.lc-divider :deep(.el-divider--horizontal)`：
 *     `:deep(A B)` 编译出来是**后代**选择器（`.lc-divider[x] .el-divider--horizontal`），
 *     而 `lc-divider` 与 `el-divider--horizontal` 是**同一个元素**上的两个类，
 *     后代选择器永远匹配不到 —— 规则静默失效，`margin` 仍是 24px。
 *     实测编译产物：`.lc-divider[data-v-a857cc2c] .el-divider--horizontal`（不匹配任何元素）。
 *
 * 用复合选择器后特异性为 (0,3,0)，稳过 Element 的 `.el-divider--horizontal`(0,1,0)。
 */
.lc-divider.el-divider--horizontal {
  margin: 0;
}
</style>
