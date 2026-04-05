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
  selectedMetrics?: Array<'value' | 'pv-production' | 'spot-price'>
}

const props = withDefaults(defineProps<Props>(), {
  selectedMetrics: () => ['value', 'pv-production']
})

type HourlyMetric = 'value' | 'pv-production' | 'spot-price'

interface HourRow {
  category: string
  avoidedPurchaseEur: number
  exportRevenueEur: number
  pvKwh: number
  avgSpotPrice: number
}

const combinedStore = useCombinedDataStore()
const tariffStore = useTariffDataStore()
const { points } = storeToRefs(combinedStore)
const { loaded: tariffLoaded } = storeToRefs(tariffStore)

const chartRef = ref<HTMLElement | null>(null)
let chart: Highcharts.Chart | null = null
let resizeObserver: ResizeObserver | null = null
const hourRowsCache = new Map<string, HourRow[]>()

function buildHourRowsCacheKey() {
  const rows = points.value
  if (!rows.length) return 'hourly-by-hour|empty'
  const first = rows[0]?.time ?? ''
  const last = rows[rows.length - 1]?.time ?? ''
  return `hourly-by-hour|${rows.length}|${first}|${last}`
}

function toEuros(valueCents: number) {
  return Number((valueCents / 100).toFixed(2))
}

const hourRows = computed<HourRow[]>(() => {
  if (!points.value.length) return []
  if (!tariffLoaded.value) return []

  const cacheKey = buildHourRowsCacheKey()
  if (hourRowsCache.has(cacheKey)) {
    return hourRowsCache.get(cacheKey) ?? []
  }

  const buckets = Array.from({ length: 24 }, () => ({
    avoidedPurchaseCents: 0,
    exportRevenueCents: 0,
    pvKwh: 0,
    spotPriceSum: 0,
    spotPriceCount: 0
  }))

  let missingValueInputs = false

  for (const point of points.value) {
    const timestampMs = Date.parse(point.time)
    if (!Number.isFinite(timestampMs)) continue

    const hour = new Date(timestampMs).getHours()
    buckets[hour].pvKwh += point.pv

    if (point.price != null) {
      buckets[hour].spotPriceSum += point.price
      buckets[hour].spotPriceCount += 1
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

    buckets[hour].avoidedPurchaseCents += avoidedBase + avoidedVat
    buckets[hour].exportRevenueCents += (spotPrice - buybackMargin) * soldKwh
  }

  if (missingValueInputs) {
    hourRowsCache.set(cacheKey, [])
    return []
  }

  const result = buckets.map((bucket, hour) => ({
    category: `${hour}h`,
    avoidedPurchaseEur: toEuros(bucket.avoidedPurchaseCents),
    exportRevenueEur: toEuros(bucket.exportRevenueCents),
    pvKwh: Number(bucket.pvKwh.toFixed(2)),
    avgSpotPrice: bucket.spotPriceCount > 0 ? Number((bucket.spotPriceSum / bucket.spotPriceCount).toFixed(2)) : 0
  }))
  hourRowsCache.set(cacheKey, result)
  return result
})

const effectiveMetrics = computed<HourlyMetric[]>(() => {
  const unique = Array.from(new Set((props.selectedMetrics ?? []) as HourlyMetric[]))
  const limited = unique.slice(0, 2)
  return limited.length > 0 ? limited : ['value']
})

function metricDisplayName(metric: HourlyMetric) {
  if (metric === 'value') return 'Value'
  if (metric === 'pv-production') return 'PV production'
  return 'Average spot price'
}

function metricUnit(metric: HourlyMetric) {
  if (metric === 'value') return '€'
  if (metric === 'pv-production') return 'kWh'
  return 'c/kWh'
}

function metricColor(metric: HourlyMetric) {
  if (metric === 'value') return '#9c27b0'
  if (metric === 'pv-production') return '#F6C142'
  return '#5B6CFF'
}

function metricData(metric: HourlyMetric) {
  if (metric === 'pv-production') return hourRows.value.map(row => row.pvKwh)
  if (metric === 'spot-price') return hourRows.value.map(row => row.avgSpotPrice)
  return hourRows.value.map(row => Number((row.avoidedPurchaseEur + row.exportRevenueEur).toFixed(2)))
}

interface AxisMetric {
  metric: HourlyMetric
  axisIndex: 0 | 1
}

function resolveAxisMetrics(): AxisMetric[] {
  const selected = effectiveMetrics.value
  if (selected.length === 1) {
    return [{ metric: selected[0], axisIndex: 0 }]
  }
  const leftMetric = selected[0]
  const rightMetric = selected[1]
  return [
    { metric: leftMetric, axisIndex: 0 },
    { metric: rightMetric, axisIndex: 1 }
  ]
}

function resolveSeries(rows: HourRow[]) {
  const axisMetrics = resolveAxisMetrics()
  const splitColumnsMode = axisMetrics.length === 2 && axisMetrics.every(item => item.metric !== 'value')
  const series: Highcharts.SeriesOptionsType[] = []

  for (const axisMetric of axisMetrics) {
    if (axisMetric.metric === 'value') {
      series.push({
        name: 'Avoided purchase',
        type: 'column',
        data: rows.map(row => row.avoidedPurchaseEur),
        color: '#9c27b0',
        stack: 'value',
        yAxis: axisMetric.axisIndex,
        pointPadding: 0.08,
        groupPadding: 0.18
      })
      series.push({
        name: 'Export revenue',
        type: 'column',
        data: rows.map(row => row.exportRevenueEur),
        color: '#ff8a65',
        stack: 'value',
        yAxis: axisMetric.axisIndex,
        pointPadding: 0.08,
        groupPadding: 0.18
      })
      continue
    }

    series.push({
      name: metricDisplayName(axisMetric.metric),
      type: 'column',
      data: metricData(axisMetric.metric),
      color: metricColor(axisMetric.metric),
      yAxis: axisMetric.axisIndex,
      pointPadding: 0.08,
      groupPadding: 0.18,
      pointPlacement: splitColumnsMode ? (axisMetric.axisIndex === 0 ? -0.2 : 0.2) : undefined
    })
  }

  return series
}

function expectedSeriesCount() {
  const axisMetrics = resolveAxisMetrics()
  return axisMetrics.reduce((acc, item) => acc + (item.metric === 'value' ? 2 : 1), 0)
}

function updateChartData() {
  if (!chart) return

  const rows = hourRows.value
  chart.xAxis[0].setCategories(rows.map(row => row.category), false)

  if (chart.series.length !== expectedSeriesCount()) {
    recreateChart()
    return
  }

  const series = resolveSeries(rows)
  chart.xAxis[0].setCategories(rows.map(row => row.category), false)

  series.forEach((serie, index) => {
    const data = (serie as Highcharts.SeriesColumnOptions).data as Array<number | null | Highcharts.PointOptionsObject>
    chart?.series[index].setData(data, false)
  })

  chart.redraw()
}

function createChart() {
  if (!chartRef.value) return

  const axisMetrics = resolveAxisMetrics()
  const hasValueMetric = axisMetrics.some(item => item.metric === 'value')
  const yAxisOptions: Highcharts.YAxisOptions[] = [
    {
      title: {
        text: `${metricDisplayName(axisMetrics[0].metric)} (${metricUnit(axisMetrics[0].metric)})`,
        style: { color: metricColor(axisMetrics[0].metric) }
      },
      labels: { style: { color: metricColor(axisMetrics[0].metric) } },
      gridLineColor: '#333'
    }
  ]

  if (axisMetrics.length > 1) {
    yAxisOptions.push({
      title: {
        text: `${metricDisplayName(axisMetrics[1].metric)} (${metricUnit(axisMetrics[1].metric)})`,
        style: { color: metricColor(axisMetrics[1].metric) }
      },
      labels: { style: { color: metricColor(axisMetrics[1].metric) } },
      gridLineColor: 'transparent',
      opposite: true
    })
  }

  const rows = hourRows.value
  const series = resolveSeries(rows)

  chart = Highcharts.chart(chartRef.value, {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    xAxis: {
      categories: hourRows.value.map(row => row.category),
      labels: {
        rotation: 0,
        step: 1,
        style: { color: '#aaa', fontSize: '0.7rem' }
      },
      crosshair: true
    },
    yAxis: yAxisOptions,
    legend: {
      enabled: true,
      itemStyle: { color: '#aaa', fontSize: '0.72rem' }
    },
    plotOptions: {
      column: {
        stacking: hasValueMetric ? 'normal' : undefined,
        borderWidth: 0,
        dataLabels: { enabled: false }
      }
    },
    series: [
      ...series
    ],
    tooltip: {
      shared: true,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      style: { color: '#fff' },
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`
        let valueTotal = 0
        this.points?.forEach(point => {
          const yAxisOption = (point.series.options as Highcharts.SeriesColumnOptions).yAxis
          const axisIdx = typeof yAxisOption === 'number' ? yAxisOption : 0
          const axisMetric = axisMetrics[axisIdx]?.metric ?? 'value'
          const unit = metricUnit(axisMetric)
          if (point.series.name === 'Avoided purchase' || point.series.name === 'Export revenue') {
            valueTotal += Number(point.y || 0)
          }
          s += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${Number(point.y || 0).toFixed(2)} ${unit}</b><br/>`
        })
        if (this.points?.some(point => point.series.name === 'Avoided purchase' || point.series.name === 'Export revenue')) {
          s += `<b>Total value: ${valueTotal.toFixed(2)} €</b>`
        }
        return s
      }
    },
    credits: { enabled: false }
  } as Highcharts.Options)
}

function recreateChart() {
  if (chart) {
    chart.destroy()
    chart = null
  }
  createChart()
}

watch(hourRows, () => {
  updateChartData()
})

watch(effectiveMetrics, () => {
  recreateChart()
}, { deep: true })

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
