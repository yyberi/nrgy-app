import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/**
 * Combined data point containing meter, solar, price and calculated fields
 */
export interface CombinedPoint {
  time: string
  in: number              // meter import (kWh)
  in_net: number | null   // meter import net (kWh)
  out: number             // meter export (kWh)
  out_net: number | null  // meter export net (kWh)
  pv: number              // solar production (kWh) - converted from Wh
  price: number | null    // electricity price (c/kWh)
  self_cons: number       // self consumption (kWh) - calculated
  tot_cons: number        // total consumption (kWh) - calculated
  saved_cons: number      // saved consumption (kWh) - calculated
}

interface DatasetMeta {
  key: string
  year: number
  month: number
}

const INDEX_URL = '/combined-data/index.json'
const DATA_BASE_URL = '/combined-data'

function datasetKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-combined`
}

function monthStartLocalMs(year: number, month: number) {
  return new Date(year, month - 1, 1).getTime()
}

function addMonthsLocalMs(ms: number, months: number) {
  const d = new Date(ms)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

function monthsBetween(startMs: number, endMsExclusive: number) {
  const months: Array<{ year: number; month: number }> = []
  if (startMs >= endMsExclusive) return months
  const startDate = new Date(startMs)
  const endDate = new Date(endMsExclusive - 1)
  let year = startDate.getFullYear()
  let month = startDate.getMonth() + 1
  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth() + 1
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

async function fetchDataset(year: number, month: number, cache: Map<string, CombinedPoint[]>) {
  const key = datasetKey(year, month)
  if (cache.has(key)) return cache.get(key) as CombinedPoint[]

  const fileName = `${year}-${String(month).padStart(2, '0')}-combined.json`
  const res = await fetch(`${DATA_BASE_URL}/${fileName}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: CombinedPoint[] = await res.json()
  cache.set(key, data)
  return data
}

function sum(values: Array<number | null | undefined>) {
  let total = 0
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value
    }
  }
  return total
}

export const useCombinedDataStore = defineStore('combinedData', () => {
  const indexLoaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const points = ref<CombinedPoint[]>([])

  function yieldToMain() {
    return new Promise<void>(resolve => {
      setTimeout(resolve, 0)
    })
  }

  const metas = ref<DatasetMeta[]>([])
  const cache = new Map<string, CombinedPoint[]>()

  const rangeStartMs = ref<number | null>(null)
  const rangeEndMsExclusive = ref<number | null>(null)
  let loadToken = 0

  // ===== Range/Availability Properties =====
  const availableStartMs = computed(() => {
    if (!metas.value.length) return null
    const first = metas.value[0]
    return monthStartLocalMs(first.year, first.month)
  })

  const availableEndMsExclusive = computed(() => {
    if (!metas.value.length) return null
    const last = metas.value[metas.value.length - 1]
    return addMonthsLocalMs(monthStartLocalMs(last.year, last.month), 1)
  })

  const rangeStartDate = computed(() => (rangeStartMs.value != null ? new Date(rangeStartMs.value) : null))
  const rangeEndDateInclusive = computed(() => {
    if (rangeEndMsExclusive.value == null) return null
    return new Date(rangeEndMsExclusive.value - 1)
  })

  // ===== Meter Data Series =====
  const seriesImport = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.in])
  )
  const seriesExport = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.out])
  )
  const seriesImportNet = computed<[number, number | null][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.in_net ?? null])
  )
  const seriesExportNet = computed<[number, number | null][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.out_net ?? null])
  )

  // ===== Meter Totals =====
  const totalImport = computed(() => sum(points.value.map(point => point.in)))
  const totalExport = computed(() => sum(points.value.map(point => point.out)))
  const totalImportNet = computed(() => sum(points.value.map(point => point.in_net)))
  const totalExportNet = computed(() => sum(points.value.map(point => point.out_net)))
  const netBalance = computed(() => totalImport.value - totalExport.value)
  const hasNetting = computed(() => points.value.some(point => point.in_net != null || point.out_net != null))

  // ===== Solar Data Series =====
  const seriesSolar = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.pv])
  )

  // ===== Solar Totals =====
  const totalSolar = computed(() => sum(points.value.map(point => point.pv)))
  const maxSolar = computed(() => Math.max(...points.value.map(point => point.pv), 0))

  // ===== Price Data Series =====
  const seriesPrice = computed<[number, number | null][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.price])
  )

  // ===== Price Statistics =====
  const minPrice = computed(() => {
    const prices = points.value.map(p => p.price).filter((p): p is number => p != null)
    if (!prices.length) return 0
    return Math.min(...prices)
  })
  const maxPrice = computed(() => {
    const prices = points.value.map(p => p.price).filter((p): p is number => p != null)
    if (!prices.length) return 0
    return Math.max(...prices)
  })
  const avgPrice = computed(() => {
    const prices = points.value.map(p => p.price).filter((p): p is number => p != null)
    if (!prices.length) return 0
    return prices.reduce((a, b) => a + b, 0) / prices.length
  })

  // ===== Calculated Fields Series =====
  const seriesSelfConsumption = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.self_cons])
  )
  const seriesTotalConsumption = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.tot_cons])
  )
  const seriesSavedConsumption = computed<[number, number][]>(() =>
    points.value.map(point => [Date.parse(point.time), point.saved_cons])
  )

  // ===== Calculated Fields Totals =====
  const totalSelfConsumption = computed(() => sum(points.value.map(point => point.self_cons)))
  const totalConsumption = computed(() => sum(points.value.map(point => point.tot_cons)))
  const totalSavedConsumption = computed(() => sum(points.value.map(point => point.saved_cons)))

  // ===== Percentage Metrics =====
  const selfConsumptionRate = computed(() => {
    if (totalSolar.value === 0) return 0
    return (totalSelfConsumption.value / totalSolar.value) * 100
  })
  const selfSufficiencyRate = computed(() => {
    if (totalConsumption.value === 0) return 0
    return (totalSelfConsumption.value / totalConsumption.value) * 100
  })

  // ===== PV Peak Records =====
  interface PeakRecord { label: string; value: number }

  const bestProductionMonth = computed<PeakRecord | null>(() => {
    if (!points.value.length) return null
    const monthMap = new Map<string, { label: string; total: number }>()
    for (const p of points.value) {
      const d = new Date(p.time)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = monthMap.get(key) || { label: key, total: 0 }
      entry.total += p.pv
      monthMap.set(key, entry)
    }
    let best: PeakRecord | null = null
    for (const m of monthMap.values()) {
      if (!best || m.total > best.value) best = { label: m.label, value: m.total }
    }
    return best
  })

  const bestProductionDay = computed<PeakRecord | null>(() => {
    if (!points.value.length) return null
    const dayMap = new Map<string, { label: string; total: number }>()
    for (const p of points.value) {
      const d = new Date(p.time)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry = dayMap.get(key) || { label: key, total: 0 }
      entry.total += p.pv
      dayMap.set(key, entry)
    }
    let best: PeakRecord | null = null
    for (const m of dayMap.values()) {
      if (!best || m.total > best.value) best = { label: m.label, value: m.total }
    }
    return best
  })

  const bestProductionHour = computed<PeakRecord | null>(() => {
    if (!points.value.length) return null
    let best: PeakRecord | null = null
    for (const p of points.value) {
      if (!best || p.pv > best.value) {
        const d = new Date(p.time)
        best = {
          label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`,
          value: p.pv
        }
      }
    }
    return best
  })

  const bestSelfConsMonth = computed<PeakRecord | null>(() => {
    if (!points.value.length) return null
    const monthMap = new Map<string, { label: string; total: number }>()
    for (const p of points.value) {
      const d = new Date(p.time)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = monthMap.get(key) || { label: key, total: 0 }
      entry.total += p.self_cons
      monthMap.set(key, entry)
    }
    let best: PeakRecord | null = null
    for (const m of monthMap.values()) {
      if (!best || m.total > best.value) best = { label: m.label, value: m.total }
    }
    return best
  })

  // ===== Cost Calculations =====
  const totalImportCost = computed(() => {
    let cost = 0
    for (const point of points.value) {
      if (point.price != null) {
        cost += point.in * point.price / 100 // price is in c/kWh, convert to €/kWh
      }
    }
    return cost
  })

  const totalExportRevenue = computed(() => {
    let revenue = 0
    for (const point of points.value) {
      if (point.price != null) {
        revenue += point.out * point.price / 100 // price is in c/kWh, convert to €/kWh
      }
    }
    return revenue
  })

  const netCost = computed(() => totalImportCost.value - totalExportRevenue.value)

  function clampRange(startMs: number, endMsExclusive: number) {
    let start = startMs
    let end = endMsExclusive
    const min = availableStartMs.value ?? start
    const maxExclusive = availableEndMsExclusive.value ?? end
    if (start < min) start = min
    if (end > maxExclusive) end = maxExclusive
    const minimumSpan = 60 * 60 * 1000 // 60 minutes
    if (start >= end) {
      if (end === maxExclusive) {
        start = Math.max(min, maxExclusive - minimumSpan)
      } else {
        end = Math.min(maxExclusive, start + minimumSpan)
      }
    }
    return { start, end }
  }

  async function loadRangePoints() {
    if (!indexLoaded.value || rangeStartMs.value == null || rangeEndMsExclusive.value == null) return
    if (!metas.value.length) return

    const token = ++loadToken
    loading.value = true
    error.value = null

    const start = rangeStartMs.value
    const endExclusive = rangeEndMsExclusive.value

    try {
      const monthsToFetch = monthsBetween(start, endExclusive).filter(({ year, month }) =>
        metas.value.some(meta => meta.year === year && meta.month === month)
      )
      const datasets = await Promise.all(
        monthsToFetch.map(({ year, month }) => fetchDataset(year, month, cache))
      )
      await yieldToMain()
      const flat = datasets.flat()
      const filtered = flat.filter(point => {
        const timestamp = Date.parse(point.time)
        return timestamp >= start && timestamp < endExclusive
      })
      if (token === loadToken) {
        points.value = filtered.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      }
    } catch (e: unknown) {
      if (token === loadToken) {
        const message = e instanceof Error ? e.message : String(e)
        error.value = `Failed to load combined dataset: ${message}`
        console.error('[combinedData] dataset load error', e)
        points.value = []
      }
    } finally {
      if (token === loadToken) {
        loading.value = false
      }
    }
  }

  async function loadIndex() {
    if (indexLoaded.value) return
    try {
      const res = await fetch(INDEX_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const files: string[] = await res.json()
      metas.value = files
        .map(file => {
          const match = file.match(/^(\d{4})-(\d{2})-combined\.json$/)
          if (!match) return null
          const [, yearStr, monthStr] = match
          return {
            key: datasetKey(Number(yearStr), Number(monthStr)),
            year: Number(yearStr),
            month: Number(monthStr)
          } satisfies DatasetMeta
        })
        .filter(Boolean) as DatasetMeta[]

      metas.value.sort((a, b) =>
        a.year - b.year ||
        a.month - b.month
      )

      indexLoaded.value = true
      if (rangeStartMs.value != null && rangeEndMsExclusive.value != null) {
        const clamped = clampRange(rangeStartMs.value, rangeEndMsExclusive.value)
        rangeStartMs.value = clamped.start
        rangeEndMsExclusive.value = clamped.end
        await loadRangePoints()
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = `Failed to load combined data index: ${message}`
      console.error('[combinedData] index load error', e)
    }
  }

  function setRange(startIso: string | Date, endIsoExclusive: string | Date) {
    const startMs = startIso instanceof Date ? startIso.getTime() : Date.parse(startIso)
    const endMs = endIsoExclusive instanceof Date ? endIsoExclusive.getTime() : Date.parse(endIsoExclusive)
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      console.warn('[combinedData] Ignoring invalid range', startIso, endIsoExclusive)
      return
    }
    const clamped = clampRange(startMs, endMs)
    const changed = clamped.start !== rangeStartMs.value || clamped.end !== rangeEndMsExclusive.value
    rangeStartMs.value = clamped.start
    rangeEndMsExclusive.value = clamped.end
    if (indexLoaded.value && changed) {
      loadRangePoints()
    }
  }

  loadIndex()

  return {
    // raw data
    points,
    
    // meter series (backward compatible with useMeterDataStore)
    seriesImport,
    seriesExport,
    seriesImportNet,
    seriesExportNet,
    totalImport,
    totalExport,
    totalImportNet,
    totalExportNet,
    netBalance,
    hasNetting,

    // solar series (backward compatible with useSolarDataStore)
    seriesSolar,
    totalSolar,
    maxSolar,

    // price series (backward compatible with usePriceDataStore)
    seriesPrice,
    minPrice,
    maxPrice,
    avgPrice,

    // calculated fields - NEW!
    seriesSelfConsumption,
    seriesTotalConsumption,
    seriesSavedConsumption,
    totalSelfConsumption,
    totalConsumption,
    totalSavedConsumption,
    selfConsumptionRate,
    selfSufficiencyRate,

    // PV peak records
    bestProductionMonth,
    bestProductionDay,
    bestProductionHour,
    bestSelfConsMonth,

    // cost calculations - NEW!
    totalImportCost,
    totalExportRevenue,
    netCost,

    // status
    indexLoaded,
    loading,
    error,

    // range
    rangeStartDate,
    rangeEndDateInclusive,
    availableStartMs,
    availableEndMsExclusive,
    setRange,
    loadRangePoints
  }
})
