<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
} from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { MATERIAL_ICONS } from '@lowcode/materials'
import { normalizePageSchema, type Material } from '@lowcode/schema'
import { materialRegistry } from '../../platform'
import { DESIGNER_KEY, type DesignerContext } from '../useDesigner'
import { buildOutlineTree, countOutlineNodes } from '../outline'
import { templateRegistry, type PageTemplate } from '../templates'
import { beginDragGhost, endDragGhost, transparentDragImage } from '../drag-ghost'

const ctx = inject<DesignerContext>(DESIGNER_KEY)!
const { setDragState, setDropTarget, schema } = ctx

/**
 * 物料的 `icon` 字段存的是**图标键**（如 `text-field`），不是可直接显示的字符。
 * 键查不到时回退成显示原始值（保留旧行为，便于渐进迁移）。
 */
function iconOf(material: Material) {
  const key = material.icon
  return key ? MATERIAL_ICONS[key] : undefined
}

const activeTab = ref<'components' | 'templates'>('components')
const keyword = ref('')
const collapsedGroups = ref<string[]>([])

/** 分组展示顺序与标题。
 *
 * 分组名与顺序对齐参考实现（`variant-form`）：容器 / 基础字段 / 高级字段 / 自定义扩展字段。
 * 参考实现里没有的物料（数据表格）归入「自定义扩展字段」——那一组在参考里的语义就是扩展位。
 */
const CATEGORY_ORDER = ['容器', '基础字段', '高级字段', '自定义扩展字段']
const CATEGORY_LABELS: Record<string, string> = {
  容器: '容器',
  基础字段: '基础字段',
  高级字段: '高级字段',
  自定义扩展字段: '自定义扩展字段',
}

const groups = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const materials = materialRegistry
    .list()
    // 内部物料（栅格列 / 表格行 / 单元格 / 标签页）与旧版兼容物料不在组件库展示
    .filter((material) => !material.hidden)
    .filter((material) => {
      if (!text) return true
      return (
        material.name.toLowerCase().includes(text) ||
        material.type.toLowerCase().includes(text) ||
        (material.description ?? '').toLowerCase().includes(text)
      )
    })

  const map = new Map<string, Material[]>()
  for (const material of materials) {
    const key = material.category || '其他'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(material)
  }

  const categories = [...map.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return categories.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    collapsed: !text && collapsedGroups.value.includes(category),
    materials: map.get(category)!,
  }))
})

/** 折叠状态由 el-collapse 的 v-model 驱动，collapsedGroups 仅作为持久记录 */
const activeGroupNames = computed<string[]>({
  get: () => groups.value.filter((group) => !group.collapsed).map((group) => group.category),
  set: (names) => {
    const all = groups.value.map((group) => group.category)
    collapsedGroups.value = all.filter((category) => !names.includes(category))
  },
})

function addMaterial(material: Material): void {
  ctx.insertMaterial(material.type)
}

function onDragStart(event: DragEvent, material: Material): void {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/x-lc-material', material.type)
    event.dataTransfer.effectAllowed = 'copy'
    // 用自有浮层替代浏览器默认影像，与画布内拖拽保持一致
    event.dataTransfer.setDragImage(transparentDragImage(), 0, 0)
  }
  beginDragGhost({ sourceEl: event.currentTarget as HTMLElement | null, label: material.name })
  setDragState({ source: 'material', materialType: material.type })
}

function onDragEnd(): void {
  setDragState(null)
  setDropTarget(null)
  endDragGhost()
}

/* ---------------- 页面模板 ---------------- */

const templates = computed<PageTemplate[]>(() => {
  void activeTab.value
  return templateRegistry.list()
})

interface TemplatePreview {
  count: number
  types: string[]
}

/** 结构预览：组件总数 + 出现过的组件类型（离线渲染，不依赖图片） */
const templatePreviews = computed<Record<string, TemplatePreview>>(() => {
  const result: Record<string, TemplatePreview> = {}
  if (activeTab.value !== 'templates') return result
  for (const template of templateRegistry.list()) {
    try {
      const outline = buildOutlineTree(normalizePageSchema(template.create()).nodes)
      const types: string[] = []
      const stack = [...outline]
      while (stack.length > 0) {
        const node = stack.pop()!
        const name = materialRegistry.get(node.type)?.name ?? node.type
        if (!types.includes(name)) types.push(name)
        stack.push(...node.children)
      }
      result[template.id] = { count: countOutlineNodes(outline), types }
    } catch {
      // 单个模板非法不影响整个面板
      result[template.id] = { count: 0, types: [] }
    }
  }
  return result
})

function applyTemplate(template: PageTemplate): void {
  const load = (): void => {
    try {
      const next = templateRegistry.instantiate(template.id)
      if (!next) {
        ElMessage.error('模板不存在或已被删除')
        return
      }
      ctx.loadSchema(next)
      ElMessage.success(`已载入模板：${template.name}`)
    } catch (error) {
      ElMessage.error(`载入模板失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (schema.value.nodes.length === 0) {
    load()
    return
  }
  ElMessageBox.confirm(
    `载入「${template.name}」会覆盖当前画布内容，确认继续？`,
    '载入页面模板',
    { type: 'warning', confirmButtonText: '载入', cancelButtonText: '取消' },
  )
    .then(load)
    .catch(() => {})
}

function removeTemplate(template: PageTemplate): void {
  templateRegistry.remove(template.id)
  ElMessage.success(`已删除模板：${template.name}`)
}

async function saveCurrentAsTemplate(): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入模板名称', '将当前页面存为模板', {
      inputValue: schema.value.meta.name,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (input: string) => (input.trim() ? true : '模板名称不能为空'),
    })
    const name = value.trim()
    const snapshot = JSON.parse(JSON.stringify(schema.value)) as typeof schema.value
    templateRegistry.register({
      id: `user_${Date.now().toString(36)}`,
      name,
      description: '由当前画布保存的自定义模板',
      tags: ['自定义'],
      create: () => JSON.parse(JSON.stringify(snapshot)),
    })
    ElMessage.success(`模板已保存：${name}`)
  } catch {
    // 取消
  }
}
</script>

<template>
  <aside class="lc-material-panel">
    <div class="lc-material-panel__tabs">
      <button
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === 'components' }"
        @click="activeTab = 'components'"
      >
        组件库
      </button>
      <button
        class="lc-tab"
        :class="{ 'lc-tab--active': activeTab === 'templates' }"
        @click="activeTab = 'templates'"
      >
        页面模板
      </button>
    </div>

    <template v-if="activeTab === 'components'">
      <div class="lc-material-panel__search">
        <el-input v-model="keyword" placeholder="搜索组件" :prefix-icon="Search" clearable />
      </div>

      <div class="lc-material-panel__list">
        <el-empty
          v-if="groups.length === 0"
          description="没有匹配的组件"
          :image-size="60"
        />

        <el-collapse v-else v-model="activeGroupNames" class="lc-widget-collapse">
          <el-collapse-item
            v-for="group in groups"
            :key="group.category"
            :name="group.category"
          >
            <template #title>
              <span class="lc-group__header">
                <span>{{ group.label }}</span>
                <span class="lc-group__count">{{ group.materials.length }}</span>
              </span>
            </template>

            <div class="lc-group__items">
              <div
                v-for="material in group.materials"
                :key="material.type"
                class="lc-material-item"
                :title="material.name"
                draggable="true"
                @click="addMaterial(material)"
                @dragstart="onDragStart($event, material)"
                @dragend="onDragEnd"
              >
                <span class="lc-material-item__icon">
                  <svg
                    v-if="iconOf(material)"
                    class="lc-material-item__svg"
                    viewBox="0 0 1024 1024"
                    aria-hidden="true"
                    v-html="iconOf(material)!.inner"
                  />
                  <template v-else>{{ material.icon ?? '◇' }}</template>
                </span>
                <span class="lc-material-item__name">{{ material.name }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>

        <p class="lc-material-panel__hint">单击添加到画布 · 拖拽可指定落点</p>
      </div>
    </template>

    <template v-else>
      <div class="lc-template-panel">
        <div v-for="template in templates" :key="template.id" class="lc-template-card">
          <div class="lc-template-card__head">
            <span class="lc-template-card__name">{{ template.name }}</span>
            <span v-if="templatePreviews[template.id]" class="lc-template-card__badge">
              {{ templatePreviews[template.id].count }} 个组件
            </span>
          </div>
          <p class="lc-template-card__desc">{{ template.description }}</p>

          <div v-if="templatePreviews[template.id]" class="lc-template-card__chips">
            <span
              v-for="type in templatePreviews[template.id].types.slice(0, 6)"
              :key="type"
              class="lc-template-card__chip"
            >
              {{ type }}
            </span>
          </div>

          <div class="lc-template-card__foot">
            <span class="lc-template-card__tags">
              <span v-for="tag in template.tags ?? []" :key="tag" class="lc-template-card__tag">
                {{ tag }}
              </span>
            </span>
            <span class="lc-template-card__actions">
              <el-button size="small" type="primary" plain @click="applyTemplate(template)">
                载入
              </el-button>
              <el-button
                v-if="!template.builtin"
                size="small"
                text
                @click="removeTemplate(template)"
              >
                删除
              </el-button>
            </span>
          </div>
        </div>

        <el-button class="lc-template-panel__save" plain @click="saveCurrentAsTemplate">
          + 将当前页面存为模板
        </el-button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.lc-material-panel {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.lc-material-panel__tabs {
  display: flex;
  border-bottom: 1px solid #e5e6eb;
}
.lc-tab {
  flex: 1;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  color: #4e5969;
}
.lc-tab--active {
  color: #3370ff;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 #3370ff;
}
.lc-material-panel__search {
  padding: 10px 12px 6px;
}
.lc-material-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}
.lc-material-panel__hint {
  margin: 6px 4px 0;
  font-size: 11px;
  color: #86909c;
  text-align: center;
}
.lc-widget-collapse {
  border-top: none;
}
.lc-widget-collapse :deep(.el-collapse-item__header) {
  height: 34px;
  border-bottom-color: #f2f3f5;
}
.lc-widget-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 4px;
}
.lc-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  font-style: italic;
  color: #1f2329;
  cursor: pointer;
}
.lc-group__count {
  padding: 0 6px;
  border-radius: 8px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  font-style: normal;
  line-height: 16px;
}
.lc-group__items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px 4px 8px;
}
.lc-material-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  cursor: grab;
  font-size: 13px;
  color: #4e5969;
  user-select: none;
  background: #fff;
}
.lc-material-item:hover {
  border-color: #3370ff;
  color: #3370ff;
  background: #f5f8ff;
}
.lc-material-item__icon {
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* 图标内联 SVG：跟随容器尺寸与文字颜色（参考实现同样靠 currentColor 取色） */
.lc-material-item__svg {
  width: 1em;
  height: 1em;
  fill: currentColor;
}
.lc-material-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-template-panel {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 16px;
}
.lc-template-card {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
  background: #fff;
}
.lc-template-card:hover {
  border-color: #3370ff;
}
.lc-template-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.lc-template-card__name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}
.lc-template-card__badge {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 8px;
  background: #e8f3ff;
  color: #3370ff;
  font-size: 11px;
  line-height: 16px;
}
.lc-template-card__desc {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: #86909c;
}
.lc-template-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.lc-template-card__chip {
  padding: 1px 6px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fafbfc;
  color: #4e5969;
  font-size: 11px;
  line-height: 16px;
}
.lc-template-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
}
.lc-template-card__tags {
  display: flex;
  gap: 4px;
}
.lc-template-card__tag {
  color: #86909c;
  font-size: 11px;
}
.lc-template-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.lc-template-panel__save {
  width: 100%;
}
</style>
