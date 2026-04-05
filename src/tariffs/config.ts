import type { TariffComponent, TariffConfig } from './types'
import { normalizeSchedule, valueAt, type NormalizedScheduleEntry } from './schedule'

export interface TariffComponentIndex {
  component: TariffComponent
  schedule: NormalizedScheduleEntry[]
}

export interface TariffConfigIndex {
  config: TariffConfig
  components: Map<string, TariffComponentIndex>
}

export function buildTariffIndex(config: TariffConfig): TariffConfigIndex {
  const components = new Map<string, TariffComponentIndex>()
  for (const component of config.components) {
    components.set(component.id, {
      component,
      schedule: normalizeSchedule(component.schedule)
    })
  }
  return { config, components }
}

export function getComponentValueAt(
  index: TariffConfigIndex,
  componentId: string,
  timestampMs: number
) {
  const item = index.components.get(componentId)
  if (!item) return null
  return valueAt(item.schedule, timestampMs)
}
