<template>
  <div class="chart-container">
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Highcharts from '@/highcharts-theme'
import { useCombinedDataStore } from '@/stores/combined-data'
import { useTariffDataStore } from '@/stores/tariff-data'

interface Props {
  aggregationOverride?: 'month' | 'year' | null
}

const props = withDefaults(defineProps<Props>(), {
  aggregationOverride: null
})

type AggregationMode = 'hour' | 'day' | 'month' | 'year'

interface BucketValueRow {
  category: string
  spotEnergyEur: number
  marginEur: number
  transferEur: number
  taxEur: number
  vatEur: number
  exportRevenueEur: number
}

interface BucketValueCents {
  spotEnergyCents: number
  marginCents: number
  transferCents: number
  taxCents: number
  vatCents: number
  exportRevenueCents: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

const combinedStore = useCombinedDataStore()
const tariffStore = useTariffDataStore()
const { points, rangeStartDate, rangeEndDateInclusive } = storeToRefs(combinedStore)
const { loaded: tariffLoaded } = storeToRefs(tariffStore)

const chartRef = ref<HTMLElement | null>(null)
let chart: Highcharts.Chart | null = null
let resizeObserver: ResizeObserver | null = null
const bucketRowsCache = new Map<string, BucketValueRow[]>()

function buildBucketRowsCacheKey(mode: AggregationMode) {
  const rows = points.value
  if (!rows.length) return `solar-value-stacked|${mode}|empty`
  const first = rows[0]?.time ?? ''
  const last = rows[rows.length - 1]?.time ?? ''
  const startMs = rangeStartDate.value?.getTime() ?? -1
  const endMs = rangeEndDateInclusive.value?.getTime() ?? -1
  return `solar-value-stacked|${mode}|${startMs}|${endMs}|${rows.length}|${first}|${last}`
}

function startOfLocalDay(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfLocalMonth(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function startOfLocalYear(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setMonth(0, 1)
  return d.getTime()
}

function startOfLocalHour(ms: number) {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

function getAggregationMode(): AggregationMode {
  if (props.aggregationOverride) return props.aggregationOverride

  const start = rangeStartDate.value?.getTime()
  const end = rangeEndDateInclusive.value?.getTime()
  if (start == null || end == null) return 'day'
  if (startOfLocalDay(start) === startOfLocalDay(end)) return 'hour'
  const spanDays = (end - start) / DAY_MS + 1
  return spanDays > 60 ? 'month' : 'day'
}

function formatCategory(bucketStartMs: number, mode: AggregationMode) {
  const d = new Date(bucketStartMs)
  if (mode === 'hour') {
    const hour = String(d.getHours()).padStart(2, '0')
    return `${hour}:00`
  }
  if (mode === 'year') {
    return String(d.getFullYear())
  }
  if (mode === 'month') {
    const spanDays = ((rangeEndDateInclusive.value?.getTime() ?? 0) - (rangeStartDate.value?.getTime() ?? 0)) / DAY_MS + 1
    if (spanDays > 400) {
      return d.toLocaleDateString('en', { year: '2-digit', month: 'short' })
    }
    return d.toLocaleDateString('en', { month: 'short' })
  }
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

function toEuros(valueCents: number) {
  return Number((valueCents / 100).toFixed(2))
}

const bucketRows = computed<BucketValueRow[]>(() => {
  if (!points.value.length || !tariffLoaded.value) return []

  const mode = getAggregationMode()
  const cacheKey = buildBucketRowsCacheKey(mode)
  if (bucketRowsCache.has(cacheKey)) {
    return bucketRowsCache.get(cacheKey) ?? []
  }
  const startMsRaw = rangeStartDate.value?.getTime()
  const endMsRaw = rangeEndDateInclusive.value?.getTime()
  const startMs = startMsRaw != null ? startOfLocalDay(startMsRaw) : null
  const endMs = endMsRaw != null ? startOfLocalDay(endMsRaw) : null
  const endExclusiveMs = endMs != null ? endMs + DAY_MS : null

  const map = new Map<number, BucketValueCents>()
  let missing = false

  for (const point of points.value) {
    const pointMs = Date.parse(point.time)
    if (!Number.isFinite(pointMs)) continue
    if (startMs != null && pointMs < startMs) continue
    if (endExclusiveMs != null && pointMs >= endExclusiveMs) continue

    const spotPrice = point.price
    const salesMargin = tariffStore.getRetailValueAt('sales_margin', pointMs)
    const transferFee = tariffStore.getGridValueAt('transfer_fee', pointMs)
    const energyTax = tariffStore.getGridValueAt('energy_tax', pointMs)
    const vatRate = tariffStore.getVatRateAt(pointMs)
    const buybackMargin = tariffStore.getRetailValueAt('buyback_margin', pointMs)

    if (
      spotPrice == null ||
      salesMargin == null ||
      transferFee == null ||
      energyTax == null ||
      vatRate == null ||
      buybackMargin == null
    ) {
      missing = true
      continue
    }

    const bucketMs =
      mode === 'year'
        ? startOfLocalYear(pointMs)
        : mode === 'month'
          ? startOfLocalMonth(pointMs)
          : mode === 'hour'
            ? startOfLocalHour(pointMs)
            : startOfLocalDay(pointMs)

    const row = map.get(bucketMs) || {
      spotEnergyCents: 0,
      marginCents: 0,
      transferCents: 0,
      taxCents: 0,
      vatCents: 0,
      exportRevenueCents: 0
    }

    const savedKwh = point.saved_cons
    const soldKwh = point.out_net ?? point.out

    row.spotEnergyCents += spotPrice * savedKwh
    row.marginCents += salesMargin * savedKwh
    row.transferCents += transferFee * savedKwh
    row.taxCents += energyTax * savedKwh
    row.vatCents += (spotPrice + salesMargin + transferFee + energyTax) * savedKwh * (vatRate / 100)
    row.exportRevenueCents += (spotPrice - buybackMargin) * soldKwh

    map.set(bucketMs, row)
  }

  if (missing) {
    bucketRowsCache.set(cacheKey, [])
    return []
  }
  if (startMs == null || endMs == null) {
    const result = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketMs, row]) => ({
        category: formatCategory(bucketMs, mode),
        spotEnergyEur: toEuros(row.spotEnergyCents),
        marginEur: toEuros(row.marginCents),
        transferEur: toEuros(row.transferCents),
        taxEur: toEuros(row.taxCents),
        vatEur: toEuros(row.vatCents),
        exportRevenueEur: toEuros(row.exportRevenueCents)
      }))
      bucketRowsCache.set(cacheKey, result)
      return result
  }

  const rows: BucketValueRow[] = []
  if (mode === 'year') {
    let cursor = startOfLocalYear(startMs)
    const endYear = startOfLocalYear(endMs)
    while (cursor <= endYear) {
      const row = map.get(cursor)
      rows.push({
        category: formatCategory(cursor, mode),
        spotEnergyEur: toEuros(row?.spotEnergyCents ?? 0),
        marginEur: toEuros(row?.marginCents ?? 0),
        transferEur: toEuros(row?.transferCents ?? 0),
        taxEur: toEuros(row?.taxCents ?? 0),
        vatEur: toEuros(row?.vatCents ?? 0),
        exportRevenueEur: toEuros(row?.exportRevenueCents ?? 0)
      })
      const d = new Date(cursor)
      d.setFullYear(d.getFullYear() + 1)
      cursor = d.getTime()
    }
    bucketRowsCache.set(cacheKey, rows)
    return rows
  }

  if (mode === 'month') {
    let cursor = startOfLocalMonth(startMs)
    const endMonth = startOfLocalMonth(endMs)
    while (cursor <= endMonth) {
      const row = map.get(cursor)
      rows.push({
        category: formatCategory(cursor, mode),
        spotEnergyEur: toEuros(row?.spotEnergyCents ?? 0),
        marginEur: toEuros(row?.marginCents ?? 0),
        transferEur: toEuros(row?.transferCents ?? 0),
        taxEur: toEuros(row?.taxCents ?? 0),
        vatEur: toEuros(row?.vatCents ?? 0),
        exportRevenueEur: toEuros(row?.exportRevenueCents ?? 0)
      })
      const d = new Date(cursor)
      d.setMonth(d.getMonth() + 1)
      cursor = d.getTime()
    }
    bucketRowsCache.set(cacheKey, rows)
    return rows
  }

  if (mode === 'hour') {
    let cursor = startMs
    while (endExclusiveMs != null && cursor < endExclusiveMs) {
      const row = map.get(cursor)
      rows.push({
        category: formatCategory(cursor, mode),
        spotEnergyEur: toEuros(row?.spotEnergyCents ?? 0),
        marginEur: toEuros(row?.marginCents ?? 0),
        transferEur: toEuros(row?.transferCents ?? 0),
        taxEur: toEuros(row?.taxCents ?? 0),
        vatEur: toEuros(row?.vatCents ?? 0),
        exportRevenueEur: toEuros(row?.exportRevenueCents ?? 0)
      })
      cursor += HOUR_MS
    }
    bucketRowsCache.set(cacheKey, rows)
    return rows
  }

  let cursor = startMs
  while (cursor <= endMs) {
    const row = map.get(cursor)
    rows.push({
      category: formatCategory(cursor, mode),
      spotEnergyEur: toEuros(row?.spotEnergyCents ?? 0),
      marginEur: toEuros(row?.marginCents ?? 0),
      transferEur: toEuros(row?.transferCents ?? 0),
      taxEur: toEuros(row?.taxCents ?? 0),
      vatEur: toEuros(row?.vatCents ?? 0),
      exportRevenueEur: toEuros(row?.exportRevenueCents ?? 0)
    })
    cursor += DAY_MS
  }
  bucketRowsCache.set(cacheKey, rows)
  return rows
})

function updateChartData() {
  if (!chart) return

  const rows = bucketRows.value
  const categories = rows.map(row => row.category)

  chart.xAxis[0].setCategories(categories, false)
  chart.series[0].setData(rows.map(row => row.spotEnergyEur), false)
  chart.series[1].setData(rows.map(row => row.marginEur), false)
  chart.series[2].setData(rows.map(row => row.transferEur), false)
  chart.series[3].setData(rows.map(row => row.taxEur), false)
  chart.series[4].setData(rows.map(row => row.vatEur), false)
  chart.series[5].setData(rows.map(row => row.exportRevenueEur), false)
  chart.redraw()
}

function createChart() {
  if (!chartRef.value) return

  chart = Highcharts.chart(chartRef.value, {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    xAxis: {
      categories: bucketRows.value.map(row => row.category),
      labels: {
        rotation: -45,
        style: { color: '#aaa', fontSize: '0.7rem' }
      },
      crosshair: true
    },
    yAxis: {
      title: { text: '€', style: { color: '#aaa' } },
      labels: { style: { color: '#aaa' } },
      gridLineColor: '#333'
    },
    legend: {
      enabled: true,
      itemStyle: { color: '#aaa', fontSize: '0.72rem' }
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        dataLabels: { enabled: false },
        borderWidth: 0
      }
    },
    series: [
      { name: 'Avoided spot price', type: 'column', data: bucketRows.value.map(row => row.spotEnergyEur), color: '#3FA7FF' },
      { name: 'Avoided sales margin', type: 'column', data: bucketRows.value.map(row => row.marginEur), color: '#7A86FF' },
      { name: 'Avoided transfer fee', type: 'column', data: bucketRows.value.map(row => row.transferEur), color: '#64CFA0' },
      { name: 'Avoided energy tax', type: 'column', data: bucketRows.value.map(row => row.taxEur), color: '#FFA726' },
      { name: 'Avoided VAT', type: 'column', data: bucketRows.value.map(row => row.vatEur), color: '#AB47BC' },
      { name: 'Export revenue', type: 'column', data: bucketRows.value.map(row => row.exportRevenueEur), color: '#2DBE7F' }
    ],
    tooltip: {
      shared: true,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      style: { color: '#fff' },
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`
        let total = 0
        this.points?.forEach(point => {
          s += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${Number(point.y || 0).toFixed(2)} €</b><br/>`
          total += point.y || 0
        })
        s += `<b>Total: ${total.toFixed(2)} €</b>`
        return s
      }
    },
    credits: { enabled: false }
  } as Highcharts.Options)
}

watch(bucketRows, () => {
  updateChartData()
})

watch(() => props.aggregationOverride, () => {
  updateChartData()
})

onMounted(() => {
  createChart()
  if (chartRef.value && chart) {
    resizeObserver = new ResizeObserver(() => {
      if (!chart) return
      chart.reflow()
    })
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chart) {
    chart.destroy()
    chart = null
  }
})
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart {
  flex: 1;
  min-height: 0;
}
</style>
