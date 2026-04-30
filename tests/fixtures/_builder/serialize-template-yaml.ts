import { stringify } from 'yaml'
import type { Fixture, FixtureDomain } from './types.js'

const TEMPLATE_DOMAINS: ReadonlySet<FixtureDomain> = new Set(['sensor', 'binary_sensor', 'switch'])

interface TemplateEntry {
  unique_id: string
  name: string
  state: string
  device_class?: string
}

/**
 * Emits a YAML *sequence* of per-domain groups suitable for inclusion via
 * `template: !include lovelacer-fixtures.yaml` in configuration.yaml. The
 * file does NOT include the leading `template:` key — HA's `!include`
 * substitutes the included content under the host key, so the file body
 * is the list of group maps directly.
 */
export function serializeTemplateYaml(fx: Fixture): string {
  const groups: Record<string, TemplateEntry[]> = {}

  for (const e of fx.entities) {
    if (e.disabled) continue
    if (!TEMPLATE_DOMAINS.has(e.domain)) continue
    if (e.templateState === null) continue

    const entry: TemplateEntry = {
      unique_id: e.uniqueId,
      name: e.originalName,
      state: e.templateState,
    }
    if (e.deviceClass !== null) entry.device_class = e.deviceClass

    const list = groups[e.domain] ?? []
    list.push(entry)
    groups[e.domain] = list
  }

  const template = Object.entries(groups).map(([domain, entries]) => ({ [domain]: entries }))
  return stringify(template, { lineWidth: 0 })
}
