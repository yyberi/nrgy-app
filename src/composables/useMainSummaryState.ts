import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { MetaItem } from '@/types/ui-summary'
import type { CombinedPoint } from '@/stores/combined-data'
import type { useTariffDataStore } from '@/stores/tariff-data'
import type { RevenueBreakdown, SavedConsumptionBreakdown } from '@/composables/useTariffCalculations'

export type SummaryView = 'total-consumption' | 'solar-value' | 'solar-production' | 'hourly-value'
export type SolarChartAggregation = 'month' | 'year'
export type HourlyMetric = 'value' | 'pv-production' | 'spot-price'

type ImportedSummaryPage = 'consumption'

export interface HourlyHighlights {
  bestValueHourLabel: string
  bestValueTotalDisplay: string
  bestValueExportDisplay: string
  bestValueAvoidedDisplay: string
  bestPvHourLabel: string
  bestPvValueDisplay: string
  highestSpotHourLabel: string
  highestSpotDisplay: string
  lowestSpotHourLabel: string
  lowestSpotDisplay: string
}

interface UseMainSummaryStateParams {
  points: Ref<CombinedPoint[]>
  rangeStartDate: Ref<Date | null>
  rangeEndDateInclusive: Ref<Date | null>
  tariffLoaded: Ref<boolean>
  tariffStore: ReturnType<typeof useTariffDataStore>
  hasNetting: Ref<boolean>
  totalImport: Ref<number>
  totalSelfConsumption: Ref<number>
  totalExport: Ref<number>
  solarTotal: Ref<number>
  meterExportTotalDisplay: ComputedRef<string>
  meterExportNetDisplay: ComputedRef<string>
  avoidedConsumptionEnergyDisplay: ComputedRef<string>
  exportRevenueBreakdown: ComputedRef<RevenueBreakdown | null>
  savedConsumptionValueBreakdown: ComputedRef<SavedConsumptionBreakdown | null>
  exportRevenueTotalDisplay: ComputedRef<string>
  savedConsumptionValueTotalDisplay: ComputedRef<string>
  savedConsumptionSpotDisplay: ComputedRef<string>
  savedConsumptionMarginDisplay: ComputedRef<string>
  savedConsumptionTransferDisplay: ComputedRef<string>
  savedConsumptionTaxDisplay: ComputedRef<string>
  savedConsumptionVatDisplay: ComputedRef<string>
  formatCurrency: (cents: number) => string
}

function formatHourOfDay(hour: number) {
  return `${hour}h`
}

export function useMainSummaryState({
  points,
  rangeStartDate,
  rangeEndDateInclusive,
  tariffLoaded,
  tariffStore,
  hasNetting,
  totalImport,
  totalSelfConsumption,
  meterExportTotalDisplay,
  meterExportNetDisplay,
  avoidedConsumptionEnergyDisplay,
  exportRevenueBreakdown,
  savedConsumptionValueBreakdown,
  exportRevenueTotalDisplay,
  savedConsumptionValueTotalDisplay,
  savedConsumptionSpotDisplay,
  savedConsumptionMarginDisplay,
  savedConsumptionTransferDisplay,
  savedConsumptionTaxDisplay,
  savedConsumptionVatDisplay,
  formatCurrency
}: UseMainSummaryStateParams) {
  const summaryView = ref<SummaryView>('solar-production')
  const summaryViewOptions: Array<{ value: SummaryView; label: string }> = [
    { value: 'solar-production', label: 'PV production' },
    { value: 'total-consumption', label: 'Total consumption' },
    { value: 'solar-value', label: 'Solar value' },
    { value: 'hourly-value', label: 'Hourly value' }
  ]

  const summaryChartAggregation = ref<SolarChartAggregation>('month')
  const hourlySelectedMetrics = ref<HourlyMetric[]>(['value', 'pv-production'])
  const hourlyMetricOptions: Array<{ value: HourlyMetric; label: string }> = [
    { value: 'value', label: 'Value' },
    { value: 'pv-production', label: 'PV-production' },
    { value: 'spot-price', label: 'Spot-price' }
  ]

  function toggleHourlyMetric(metric: HourlyMetric) {
    const current = hourlySelectedMetrics.value
    if (current.includes(metric)) {
      if (current.length === 1) return
      hourlySelectedMetrics.value = current.filter(item => item !== metric)
      return
    }
    if (current.length < 2) {
      hourlySelectedMetrics.value = [...current, metric]
      return
    }
    hourlySelectedMetrics.value = [current[1], metric]
  }

  const hourlyMetricsLabel = computed(() => {
    const labelByMetric: Record<HourlyMetric, string> = {
      value: 'Value',
      'pv-production': 'PV production',
      'spot-price': 'Spot price'
    }
    return hourlySelectedMetrics.value.map(metric => labelByMetric[metric]).join(' + ')
  })

  const summaryPanelTitle = computed(() => {
    if (summaryView.value === 'total-consumption') return 'Consumption'
    if (summaryView.value === 'solar-production') return 'PV production'
    if (summaryView.value === 'hourly-value') return `Hourly: ${hourlyMetricsLabel.value}`
    return 'Solar value components'
  })

  const isMultiYearRange = computed(() => {
    const start = rangeStartDate.value
    const end = rangeEndDateInclusive.value
    if (!start || !end) return false
    return end.getFullYear() > start.getFullYear()
  })

  const summaryChartAggregationOverride = computed(() =>
    isMultiYearRange.value ? summaryChartAggregation.value : null
  )

  const importedSummaryPage = ref<ImportedSummaryPage>('consumption')
  const importedSummaryPages = [{ key: 'consumption', label: 'Consumption' }]
  const importedSummaryPagesForView = computed(() => importedSummaryPages)

  const importedConsumptionTotal = computed(() => totalImport.value + totalSelfConsumption.value)

  const solarValueTotalCents = computed(() => {
    if (!savedConsumptionValueBreakdown.value || !exportRevenueBreakdown.value) return null
    return savedConsumptionValueBreakdown.value.totalCents + exportRevenueBreakdown.value.revenueCents
  })

  const summaryTotalHeaderDisplay = computed(() => {
    if (summaryView.value === 'solar-value') {
      return solarValueTotalCents.value != null ? formatCurrency(solarValueTotalCents.value) : '—'
    }
    if (summaryView.value === 'hourly-value') return ''
    if (summaryView.value === 'solar-production') return ''
    return ''
  })

  const hourlyHighlightsCache = new Map<string, HourlyHighlights | null>()

  function buildHourlyHighlightsCacheKey() {
    const rows = points.value
    if (!rows.length) return 'hourly|empty'
    const first = rows[0]?.time ?? ''
    const last = rows[rows.length - 1]?.time ?? ''
    return `hourly|${rows.length}|${first}|${last}`
  }

  const hourlyHighlights = computed<HourlyHighlights | null>(() => {
    if (!points.value.length) return null
    if (!tariffLoaded.value) return null

    const cacheKey = buildHourlyHighlightsCacheKey()
    if (hourlyHighlightsCache.has(cacheKey)) {
      return hourlyHighlightsCache.get(cacheKey) ?? null
    }

    const rows = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      avoidedCents: 0,
      exportCents: 0,
      pvKwh: 0,
      spotSum: 0,
      spotCount: 0
    }))

    let missingValueInputs = false

    for (const point of points.value) {
      const timestampMs = Date.parse(point.time)
      if (!Number.isFinite(timestampMs)) continue

      const hour = new Date(timestampMs).getHours()
      const row = rows[hour]

      row.pvKwh += point.pv
      if (point.price != null) {
        row.spotSum += point.price
        row.spotCount += 1
      }

      const spotPrice = point.price
      const salesMargin = tariffStore.getRetailValueAt('sales_margin', timestampMs)
      const transferFee = tariffStore.getGridValueAt('transfer_fee', timestampMs)
      const energyTax = tariffStore.getGridValueAt('energy_tax', timestampMs)
      const vatRate = tariffStore.getVatRateAt(timestampMs)
      const buybackMargin = tariffStore.getRetailValueAt('buyback_margin', timestampMs)

      if (
        spotPrice == null ||
        salesMargin == null ||
        transferFee == null ||
        energyTax == null ||
        vatRate == null ||
        buybackMargin == null
      ) {
        missingValueInputs = true
        continue
      }

      const savedKwh = point.saved_cons
      const soldKwh = point.out_net ?? point.out

      const avoidedBase = (spotPrice + salesMargin + transferFee + energyTax) * savedKwh
      const avoidedVat = avoidedBase * (vatRate / 100)

      row.avoidedCents += avoidedBase + avoidedVat
      row.exportCents += (spotPrice - buybackMargin) * soldKwh
    }

    if (missingValueInputs) {
      hourlyHighlightsCache.set(cacheKey, null)
      return null
    }

    const bestValueRow = rows.reduce((best, row) => {
      const bestTotal = best.avoidedCents + best.exportCents
      const rowTotal = row.avoidedCents + row.exportCents
      return rowTotal > bestTotal ? row : best
    }, rows[0])

    const bestPvRow = rows.reduce((best, row) => (row.pvKwh > best.pvKwh ? row : best), rows[0])

    const spotRows = rows
      .filter(row => row.spotCount > 0)
      .map(row => ({
        hour: row.hour,
        avgSpot: row.spotSum / row.spotCount
      }))

    if (!spotRows.length) {
      hourlyHighlightsCache.set(cacheKey, null)
      return null
    }

    const highestSpotRow = spotRows.reduce((best, row) => (row.avgSpot > best.avgSpot ? row : best), spotRows[0])
    const lowestSpotRow = spotRows.reduce((best, row) => (row.avgSpot < best.avgSpot ? row : best), spotRows[0])

    const bestValueTotalCents = bestValueRow.avoidedCents + bestValueRow.exportCents

    const result = {
      bestValueHourLabel: formatHourOfDay(bestValueRow.hour),
      bestValueTotalDisplay: formatCurrency(bestValueTotalCents),
      bestValueExportDisplay: formatCurrency(bestValueRow.exportCents),
      bestValueAvoidedDisplay: formatCurrency(bestValueRow.avoidedCents),
      bestPvHourLabel: formatHourOfDay(bestPvRow.hour),
      bestPvValueDisplay: `${bestPvRow.pvKwh.toFixed(2)} kWh`,
      highestSpotHourLabel: formatHourOfDay(highestSpotRow.hour),
      highestSpotDisplay: `${highestSpotRow.avgSpot.toFixed(2)} c/kWh`,
      lowestSpotHourLabel: formatHourOfDay(lowestSpotRow.hour),
      lowestSpotDisplay: `${lowestSpotRow.avgSpot.toFixed(2)} c/kWh`
    }

    hourlyHighlightsCache.set(cacheKey, result)
    return result
  })

  const exportSummaryMeta = computed<MetaItem[]>(() => {
    const items: MetaItem[] = []
    if (hasNetting.value) {
      items.push({ label: 'Netted export', value: meterExportNetDisplay.value })
    }
    items.push(
      { label: 'Revenue', value: exportRevenueTotalDisplay.value },
      { label: 'Saved consumption value', value: savedConsumptionValueTotalDisplay.value, isSection: true },
      { label: 'Avoided spot price', value: savedConsumptionSpotDisplay.value },
      { label: 'Avoided sales margin', value: savedConsumptionMarginDisplay.value },
      { label: 'Avoided transfer fee', value: savedConsumptionTransferDisplay.value },
      { label: 'Avoided energy tax', value: savedConsumptionTaxDisplay.value },
      { label: 'Avoided VAT', value: savedConsumptionVatDisplay.value }
    )
    return items
  })

  const solarValueSummary = computed(() => ({
    meterExportTotalDisplay: meterExportTotalDisplay.value,
    avoidedConsumptionEnergyDisplay: avoidedConsumptionEnergyDisplay.value,
    meterExportNetDisplay: meterExportNetDisplay.value,
    exportRevenueTotalDisplay: exportRevenueTotalDisplay.value,
    savedConsumptionValueTotalDisplay: savedConsumptionValueTotalDisplay.value,
    savedConsumptionSpotDisplay: savedConsumptionSpotDisplay.value,
    savedConsumptionMarginDisplay: savedConsumptionMarginDisplay.value,
    savedConsumptionTransferDisplay: savedConsumptionTransferDisplay.value,
    savedConsumptionTaxDisplay: savedConsumptionTaxDisplay.value,
    savedConsumptionVatDisplay: savedConsumptionVatDisplay.value,
    hasNetting: hasNetting.value
  }))

  watch(summaryView, () => {
    importedSummaryPage.value = 'consumption'
  })

  return {
    summaryView,
    summaryViewOptions,
    summaryChartAggregation,
    summaryChartAggregationOverride,
    isMultiYearRange,
    hourlySelectedMetrics,
    hourlyMetricOptions,
    hourlyMetricsLabel,
    summaryPanelTitle,
    toggleHourlyMetric,
    importedSummaryPage,
    importedSummaryPagesForView,
    importedConsumptionTotal,
    summaryTotalHeaderDisplay,
    hourlyHighlights,
    exportSummaryMeta,
    solarValueSummary
  }
}
