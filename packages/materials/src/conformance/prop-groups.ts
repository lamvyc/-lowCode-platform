import type { PropGroup } from '@lowcode/schema'
import type { MaterialManifest } from '../manifest'
import { mapOption, WIDGET_TYPE_ALIASES } from './audit'
import type {
  ReferencePropertyGroups,
  ReferenceSpec,
  ReferenceWidgetSpec,
} from './reference-spec'

/**
 * 「高级设置 / 事件设置」与参考实现的属性分组对齐审计。
 *
 * 参考实现（variant-form）的属性面板由三张注册表驱动：
 *   - `COMMON_PROPERTIES`   → 基础（本仓库叫「通用设置」）
 *   - `ADVANCED_PROPERTIES` → 高级（本仓库叫「高级设置」）
 *   - `EVENT_PROPERTIES`    → 事件（本仓库叫「事件设置」）
 * 每个 widget 的 options 键决定这三组里**实际显示哪些项**。
 *
 * 本仓库此前把字段校验 / 组件大小 / 标签排版等（参考里属于「基础」的项）
 * 统一塞进了「高级设置」，导致两边的折叠区内容对不上。这里把参考的
 * 三张注册表解析成机器可读基线，逐 widget 检查**分组归属**：
 *   · 参考 register 里登记过的 option → 本仓库面板项必须落在同一分组；
 *   · 参考的事件属性 → 必须出现在事件设置（物料 events 或事件类 propConfig）；
 *   · 参考没有的事件 → 不应出现在事件设置里。
 * 参考未登记的 option（如 md/sm/xs，参考根本不渲染面板项）以及本仓库
 * 扩展物料（alert / data-table / image 等）不参与比对。
 */

/** 单个属性的分组差异 */
export interface PropGroupMismatch {
  /** 参考 widget 类型 */
  widget: string
  /** 参考 option 名 */
  option: string
  /** 本仓库对应的属性名 */
  prop: string
  expected: PropGroup
  actual: PropGroup | 'missing'
}

/** 单个事件的差异：参考有我们没有 / 我们有参考没有 */
export interface EventGroupMismatch {
  widget: string
  event: string
  kind: 'missing' | 'extra'
}

export interface PropGroupAudit {
  /** 参与比对的参考 widget 数 */
  checkedWidgets: number
  /** 分组归属不一致（含面板项缺失） */
  mismatches: PropGroupMismatch[]
  /** 事件属性缺失 / 多出 */
  events: EventGroupMismatch[]
}

/** 与属性面板一致的分区推断：显式 group 优先，事件控件归 event，其余归 common */
function configGroup(config: { group?: PropGroup; control?: string }): PropGroup {
  if (config.group) return config.group
  return config.control === 'event' || config.control === 'events' ? 'event' : 'common'
}

function declaredEventLabels(manifest: MaterialManifest): Set<string> {
  const labels = new Set<string>()
  for (const event of manifest.events ?? []) labels.add(event.label ?? event.name)
  for (const config of manifest.propConfigs) {
    if (configGroup(config) === 'event') labels.add(config.name)
  }
  return labels
}

function auditWidget(
  audit: PropGroupAudit,
  groups: ReferencePropertyGroups,
  widget: ReferenceWidgetSpec,
  manifest: MaterialManifest,
): void {
  const configByName = new Map(manifest.propConfigs.map((config) => [config.name, config]))
  const declared = declaredEventLabels(manifest)

  for (const option of widget.optionKeys) {
    const expected = groups.groupOf[option]
    if (!expected) continue // 参考未登记 → 面板不展示，不参与分组对齐
    const prop = mapOption(widget.type, option)

    if (expected === 'event') {
      if (!declared.has(option)) {
        audit.events.push({ widget: widget.type, event: option, kind: 'missing' })
      }
      continue
    }

    const config = configByName.get(prop)
    if (!config) {
      audit.mismatches.push({ widget: widget.type, option, prop, expected, actual: 'missing' })
      continue
    }
    const actual = configGroup(config)
    if (actual !== expected) {
      audit.mismatches.push({ widget: widget.type, option, prop, expected, actual })
    }
  }

  // 事件设置里多出来的项：参考该 widget 的 options 里没有这个 onXxx
  for (const label of declared) {
    const expectedByReference = widget.optionKeys.includes(label)
    if (!expectedByReference) {
      audit.events.push({ widget: widget.type, event: label, kind: 'extra' })
    }
  }
}

/** 逐 widget 比对分组归属（参考基线缺失时返回空审计） */
export function auditPropGroups(
  reference: ReferenceSpec,
  manifests: MaterialManifest[],
): PropGroupAudit {
  const groups = reference.propertyGroups
  const audit: PropGroupAudit = { checkedWidgets: 0, mismatches: [], events: [] }
  if (!groups) return audit

  const byType = new Map(manifests.map((manifest) => [manifest.type, manifest]))
  for (const widget of reference.widgets) {
    if (widget.group === 'custom') continue
    const manifest = byType.get(WIDGET_TYPE_ALIASES[widget.type] ?? widget.type)
    if (!manifest) continue
    audit.checkedWidgets += 1
    auditWidget(audit, groups, widget, manifest)
  }
  return audit
}
