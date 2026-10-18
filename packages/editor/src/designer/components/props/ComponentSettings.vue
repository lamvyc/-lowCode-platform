<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ElCollapse, ElCollapseItem } from 'element-plus'
import type { Material, PageNode, PropConfig } from '@lowcode/schema'
import {
  groupPropConfigs,
  isPropVisible,
  materialPropConfigs,
  resolvePropGroup,
} from '../../props-config'
import { DESIGNER_KEY, type DesignerContext } from '../../useDesigner'
import PropField from './PropField.vue'
import EventSettings from './EventSettings.vue'

const props = defineProps<{
  node: PageNode
  material?: Material
  /** 表单自定义 CSS 中提取出的类名 */
  customClasses: string[]
}>()

const ctx = inject<DesignerContext>(DESIGNER_KEY)!

/** 除事件外的属性分区（事件分区统一由 EventSettings 渲染） */
const allConfigs = computed<PropConfig[]>(() => materialPropConfigs(props.material))

const groups = computed(() =>
  groupPropConfigs(allConfigs.value)
    .filter((group) => group.key !== 'event')
    .map((group) => ({
      ...group,
      configs: group.configs.filter((config) =>
        isPropVisible(config, props.node, allConfigs.value, ctx.state.device),
      ),
    }))
    .filter((group) => group.configs.length > 0),
)

/** 以 control 声明的事件属性（老物料兼容），与 material.events 合并展示 */
const eventPropConfigs = computed<PropConfig[]>(() =>
  allConfigs.value.filter(
    (config) =>
      resolvePropGroup(config) === 'event' &&
      isPropVisible(config, props.node, allConfigs.value, ctx.state.device),
  ),
)

const hasEvents = computed(
  () =>
    eventPropConfigs.value.length > 0 ||
    (props.material?.events?.length ?? 0) > 0 ||
    Object.keys(props.node.events ?? {}).length > 0,
)

/** 默认展开「通用设置」与「事件设置」，与参考实现保持一致 */
const activeNames = ref<string[]>(['common', 'event'])
</script>

<template>
  <el-collapse v-model="activeNames" class="lc-setting-collapse">
    <el-collapse-item v-for="group in groups" :key="group.key" :name="group.key">
      <template #title>
        <span class="lc-setting-collapse__title">{{ group.label }}</span>
        <span v-if="group.hint" class="lc-setting-collapse__hint">{{ group.hint }}</span>
      </template>
      <PropField
        v-for="config in group.configs"
        :key="config.name"
        :node="node"
        :config="config"
        :custom-classes="customClasses"
      />
    </el-collapse-item>

    <el-collapse-item v-if="hasEvents" name="event">
      <template #title>
        <span class="lc-setting-collapse__title">事件设置</span>
        <span class="lc-setting-collapse__hint">为组件绑定交互动作链</span>
      </template>

      <PropField
        v-for="config in eventPropConfigs"
        :key="config.name"
        :node="node"
        :config="config"
        :custom-classes="customClasses"
      />

      <EventSettings :node="node" :event-configs="material?.events" />
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped>
.lc-setting-collapse {
  border-top: none;
}
.lc-setting-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  border-bottom-color: #f2f3f5;
}
.lc-setting-collapse :deep(.el-collapse-item__content) {
  padding: 10px 4px 4px;
}
.lc-setting-collapse__title {
  font-style: italic;
}
.lc-setting-collapse__hint {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  font-style: normal;
  color: #86909c;
}
</style>
