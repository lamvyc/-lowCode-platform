<script setup lang="ts">
import { nextTick, provide, ref, watch } from 'vue'
import { ElTabs } from 'element-plus'

defineOptions({ name: 'LcTab' })

const props = withDefaults(
  defineProps<{
    /** 标签页样式：边框卡片 / 卡片 / 默认 */
    displayType?: 'border-card' | 'card' | ''
    /** 默认激活的标签页 name；为空时自动激活**第一个**面板 */
    activeName?: string
  }>(),
  {
    displayType: 'border-card',
    activeName: '',
  },
)

/**
 * ⚠️ 这里修的是一个真实 bug：**新建标签页后没有任何面板处于激活状态**。
 *
 * 原先的假设是「`active` 为空串时 ElTabs 会自行选中第一个 pane」—— **这是错的**。
 * 实测：各面板的 name 由 Element Plus 自动生成，与空串的 `active` 永远对不上，
 * 于是**所有面板都是 `aria-hidden="true"` / `display: none`**。
 *
 * 症状有两个：
 *   ① 新建的标签页内容区是空的（其实是"没选中任何面板"）；
 *   ② el-tabs 比参考矮 28px（激活面板的 min-height 不生效）。
 *
 * ### 为什么不用 provide/inject 让子面板注册
 *
 * 试过：`TabPane` 在 `onMounted` 里向父级注册名字，`Tab` 拿第一个注册的当激活项。
 * **不行** —— 实测同一份 schema（1 个面板）会挂载出**两个 TabPane 实例**
 * （`onMounted` 触发两次、名字不同），而 DOM 里只留下后一个。
 * 于是"第一个注册的"指向一个已卸载的实例，激活名与真实面板对不上，依然不生效。
 *
 * 所以改成**直接读真实渲染出来的面板名字**（ElTabs 把面板 `id` 写成 `pane-<name>`）：
 * 不依赖挂载顺序，也不依赖实例数量。
 */
const active = ref<string | number>(props.activeName)
/** 用户是否亲手点过标签（点过之后就不再自动改激活项） */
const userPicked = ref(false)

provide('lcTabRegisterPane', (name: string) => {
  // ⚠️ 关键：同一份 schema 会挂载出**两个 TabPane 实例**（实测 onMounted 触发两次、
  //    名字不同），而 DOM 里只留下**后一个**。所以必须让"最后一次注册"生效，
  //    否则激活名会指向一个已卸载的实例、面板永远不亮。
  if (userPicked.value) return
  nextTick(() => {
    if (!userPicked.value) active.value = name
  })
})

function onTabClick(): void {
  userPicked.value = true
}

/**
 * 面板上显式标了 `active: true` 时，它就是**默认激活项**（参考实现用
 * `options.active` 标记当前激活面板）。没标的话退回"最后注册的那个"。
 */
provide('lcTabPreferredPane', (name: string) => {
  // 显式指定即视为用户选择，不再被自动逻辑覆盖；同时**直接把激活项设为该面板**。
  // 只置 userPicked 而不置 active 会让 `active: true` 的面板反而不亮
  // （注册回调看到 userPicked 后直接 return），模板里的标签页会整片空白。
  userPicked.value = true
  active.value = name
})

watch(
  () => props.activeName,
  (value) => {
    // schema 里显式指定了就尊重它
    userPicked.value = Boolean(value)
    active.value = value
  },
)
</script>

<template>
  <!-- 外面这层对应参考的 `.tab-container`（`margin: 2px`）。
       ⚠️ 2px 必须挂在**包裹层**上而不是 `.el-tabs` 上：
       两者都会让 el-tabs 窄 4px，但参考的 el-tabs 自己 margin 是 0。 -->
  <div class="lc-tab-container">
    <ElTabs v-model="active" class="lc-tab" :type="displayType || undefined" @tab-click="onTabClick">
      <slot />
    </ElTabs>
  </div>
</template>

<style scoped>
.lc-tab {
  box-sizing: border-box;
  /* 无 pane 时也要有高度，否则画布上无法作为拖拽落点 */
  min-height: 40px;
}

/* 参考的 `tab-widget.vue` 里 `.tab-container { margin: 2px }`，
   于是它的 el-tabs 比容器窄 4px（实测 1000 vs 我们 1004）。 */
.lc-tab-container {
  margin: 2px;
}

/* ⚠️ 必须走 `:deep()`：本块是 `scoped`，直接写 `.el-tab-pane` 会编译成
   `.el-tab-pane[data-v-x]`，而面板是 ElTabs 的内部元素、**没有 scope 属性**，
   规则永远不匹配（实测 min-height 仍是 0px）。
   `.lc-tab` 本身落在 ElTabs 根元素（我们模板的根），带 scope 属性，所以能当锚点。

   参考 `tab-widget.vue`：`.tab-container .form-widget-list { min-height: 28px }`，
   即每个面板内容区至少 28px。实测参考 el-tabs 高 99、我们 71，差的正是这 28px。 */
.lc-tab :deep(.el-tab-pane) {
  min-height: 28px;
}
</style>
