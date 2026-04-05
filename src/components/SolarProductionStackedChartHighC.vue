<template>
  <div class="chart-container">
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import Highcharts from 'highcharts'
import { useCombinedDataStore } from '@/stores/combined-data'

interface Props {
  aggregationOverride?: 'month' | 'year' | null
}

const props = withDefaults(defineProps<Props>(), {
  aggregationOverride: null
})

const combinedStore = useCombinedDataStore()
const { points, rangeStartDate, rangeEndDateInclusive } = storeToRefs(combinedStore)

const chartRef = ref<HTMLElement | null>(null)
let chart: Highcharts.Chart | null = null
let resizeObserver: ResizeObserver | null = null
const DAY_MS = 24 * 60 * 60 * 1000
const aggregatedDataCache = new Map<string, AggregatedData[]>()

type AggregationMode = 'hour' | 'day' | 'month' | 'year'

interface AggregatedData {
  category: string
  selfConsumption: number
  exported: number
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

function buildAggregationCacheKey(mode: AggregationMode, dataPoints: typeof points.value) {
  if (!dataPoints.length) return `solar-production-stacked|${mode}|empty`
  const first = dataPoints[0]?.time ?? ''
  const last = dataPoints[dataPoints.length - 1]?.time ?? ''
  const startMs = rangeStartDate.value?.getTime() ?? -1
  const endMs = rangeEndDateInclusive.value?.getTime() ?? -1
  return `solar-production-stacked|${mode}|${startMs}|${endMs}|${dataPoints.length}|${first}|${last}`
}

function aggregateForRange(dataPoints: typeof points.value): AggregatedData[] {
  const mode = getAggregationMode()
  const cacheKey = buildAggregationCacheKey(mode, dataPoints)
  if (aggregatedDataCache.has(cacheKey)) {
    return aggregatedDataCache.get(cacheKey) ?? []
  }
  const startMsRaw = rangeStartDate.value?.getTime()
  const endMsRaw = rangeEndDateInclusive.value?.getTime()
  const startMs = startMsRaw != null ? startOfLocalDay(startMsRaw) : null
  const endMs = endMsRaw != null ? startOfLocalDay(endMsRaw) : null
  const endExclusiveMs = endMs != null ? startOfLocalDay(endMs + DAY_MS) : null

  const bucketMap = new Map<number, { selfConsumption: number; exported: number }>()

  for (const point of dataPoints) {
    const pointMs = Date.parse(point.time)
    if (!Number.isFinite(pointMs)) continue

    if (startMs != null && pointMs < startMs) continue
    if (endExclusiveMs != null && pointMs >= endExclusiveMs) continue

    const bucketMs =
      mode === 'year'
        ? startOfLocalYear(pointMs)
        : mode === 'month'
          ? startOfLocalMonth(pointMs)
          : mode === 'hour'
            ? startOfLocalHour(pointMs)
            : startOfLocalDay(pointMs)
    const existing = bucketMap.get(bucketMs) || { selfConsumption: 0, exported: 0 }

    // Solar production split:
    // selfConsumption = self_cons (PV consumed on-site)
    // exported = out (energy exported to grid)
    existing.selfConsumption += point.self_cons || 0
    existing.exported += point.out || 0

    bucketMap.set(bucketMs, existing)
  }

  if (startMs == null || endMs == null) {
    const result = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucketStartMs, data]) => ({
        category: formatCategory(bucketStartMs, mode),
        selfConsumption: Number(data.selfConsumption.toFixed(2)),
        exported: Number(data.exported.toFixed(2))
      }))
    aggregatedDataCache.set(cacheKey, result)
    return result
  }

  if (mode === 'hour') {
    const rows: AggregatedData[] = []
    let cursor = startMs
    while (endExclusiveMs != null && cursor < endExclusiveMs) {
      const data = bucketMap.get(cursor) || { selfConsumption: 0, exported: 0 }
      rows.push({
        category: formatCategory(cursor, mode),
        selfConsumption: Number(data.selfConsumption.toFixed(2)),
        exported: Number(data.exported.toFixed(2))
      })
      const d = new Date(cursor)
      d.setHours(d.getHours() + 1)
      cursor = d.getTime()
    }
    aggregatedDataCache.set(cacheKey, rows)
    return rows
  }

  const rows: AggregatedData[] = []
  if (mode === 'year') {
    let cursor = startOfLocalYear(startMs)
    const endYear = startOfLocalYear(endMs)
    while (cursor <= endYear) {
      const data = bucketMap.get(cursor) || { selfConsumption: 0, exported: 0 }
      rows.push({
        category: formatCategory(cursor, mode),
        selfConsumption: Number(data.selfConsumption.toFixed(2)),
        exported: Number(data.exported.toFixed(2))
      })
      const d = new Date(cursor)
      d.setFullYear(d.getFullYear() + 1)
      cursor = d.getTime()
    }
    aggregatedDataCache.set(cacheKey, rows)
    return rows
  }

  if (mode === 'month') {
    let cursor = startOfLocalMonth(startMs)
    const endMonth = startOfLocalMonth(endMs)
    while (cursor <= endMonth) {
      const data = bucketMap.get(cursor) || { selfConsumption: 0, exported: 0 }
      rows.push({
        category: formatCategory(cursor, mode),
        selfConsumption: Number(data.selfConsumption.toFixed(2)),
        exported: Number(data.exported.toFixed(2))
      })
      const d = new Date(cursor)
      d.setMonth(d.getMonth() + 1)
      cursor = d.getTime()
    }
    aggregatedDataCache.set(cacheKey, rows)
    return rows
  }

  let cursor = startMs
  while (cursor <= endMs) {
    const data = bucketMap.get(cursor) || { selfConsumption: 0, exported: 0 }
    rows.push({
      category: formatCategory(cursor, mode),
      selfConsumption: Number(data.selfConsumption.toFixed(2)),
      exported: Number(data.exported.toFixed(2))
    })
    const d = new Date(cursor)
    d.setDate(d.getDate() + 1)
    cursor = d.getTime()
  }
  aggregatedDataCache.set(cacheKey, rows)
  return rows
}

function updateChartData() {
  if (!chart || !chartRef.value) return

  const aggregatedData = aggregateForRange(points.value)

  if (aggregatedData.length === 0) {
    chart.series[0].setData([], false)
    chart.series[1].setData([], false)
    chart.xAxis[0].setCategories([], false)
    chart.redraw()
    return
  }

  const categories = aggregatedData.map((d) => d.category)
  const exportedData = aggregatedData.map((d) => d.exported)
  const selfConsumptionData = aggregatedData.map((d) => d.selfConsumption)

  chart.xAxis[0].setCategories(categories, false)
  chart.series[0].setData(exportedData, false)
  chart.series[1].setData(selfConsumptionData, false)
  chart.redraw()
}

function createChart() {
  if (!chartRef.value) return

  if (chart) {
    chart.destroy()
    chart = null
  }

  const aggregatedData = aggregateForRange(points.value)
  const categories = aggregatedData.map((d) => d.category)
  const exportedData = aggregatedData.map((d) => d.exported)
  const selfConsumptionData = aggregatedData.map((d) => d.selfConsumption)

  chart = Highcharts.chart(chartRef.value, {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    xAxis: {
      categories,
      labels: {
        rotation: -45,
        style: { color: '#aaa', fontSize: '0.7rem' }
      },
      crosshair: true
    },
    yAxis: {
      title: { text: 'kWh', style: { color: '#aaa' } },
      labels: { style: { color: '#aaa' } },
      gridLineColor: '#333'
    },
    legend: {
      enabled: true,
      itemStyle: { color: '#aaa' }
    },
    plotOptions: {
      column: {
        stacking: 'normal',
        dataLabels: { enabled: false },
        borderWidth: 0
      }
    },
    series: [
      {
        name: 'Surplus',
        type: 'column',
        data: exportedData,
        color: '#F6C142',
        tooltip: {
          valueSuffix: ' kWh'
        }
      },
      {
        name: 'Self consumption',
        type: 'column',
        data: selfConsumptionData,
        color: '#2DBE7F',
        tooltip: {
          valueSuffix: ' kWh'
        }
      }
    ],
    tooltip: {
      shared: true,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      style: { color: '#fff' },
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`
        let total = 0
        this.points?.forEach((point) => {
          s += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${point.y} kWh</b><br/>`
          total += point.y || 0
        })
        s += `<b>Total production: ${total.toFixed(2)} kWh</b>`
        return s
      }
    },
    credits: { enabled: false }
  })
}

watch(points, () => {
  updateChartData()
})

watch([rangeStartDate, rangeEndDateInclusive], () => {
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
