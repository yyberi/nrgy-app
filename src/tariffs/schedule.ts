import { helsinkiDateToUtcMs } from './helsinki-time'
import type { TariffScheduleEntry } from './types'

export interface NormalizedScheduleEntry {
  from: string
  fromMs: number
  value: number
}

export function normalizeSchedule(schedule: TariffScheduleEntry[]) {
  return schedule
    .map(entry => ({
      from: entry.from,
      fromMs: helsinkiDateToUtcMs(entry.from),
      value: entry.value
    }))
    .filter(entry => Number.isFinite(entry.fromMs))
    .sort((a, b) => a.fromMs - b.fromMs)
}

export function valueAt(schedule: NormalizedScheduleEntry[], timestampMs: number) {
  if (!schedule.length || !Number.isFinite(timestampMs)) return null
  let current: NormalizedScheduleEntry | null = null
  for (const entry of schedule) {
    if (entry.fromMs <= timestampMs) {
      current = entry
    } else {
      break
    }
  }
  return current ? current.value : null
}
