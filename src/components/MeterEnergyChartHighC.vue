<template>
  <div class="chart-container">
    <div :id="chartId"></div>
  </div>
</template>

<script setup lang="ts">
import Highcharts from '@/highcharts-theme'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCombinedDataStore } from '@/stores/combined-data'
import { registerHighCChart, unregisterHighCChart } from '@/highcharts-sync'

interface Props {
  mode: 'import' | 'export'
}

const props = defineProps<Props>()

const chartId = ref(`chart-container-${Math.random().toString(36).slice(2)}`)
const currentTime = ref('')
const currentValue = ref('')
const DAY_MS = 24 * 3600 * 1000
const combinedStore = useCombinedDataStore()
const {
  seriesImport,
  seriesExport,
  rangeStartDate,
  rangeEndDateInclusive,
  availableStartMs,
  availableEndMsExclusive
} = storeToRefs(combinedStore)

function formatDayMonth(valueMs: number) {
  const d = new Date(valueMs)
  return `${d.getDate()}.${d.getMonth() + 1}`
}

function isAllRangeSelected() {
  const start = rangeStartDate.value?.getTime()
  const endInclusive = rangeEndDateInclusive.value?.getTime()
  const availableStart = availableStartMs.value
  const availableEndExclusive = availableEndMsExclusive.value
  if (start == null || endInclusive == null || availableStart == null || availableEndExclusive == null) return false
  return start === availableStart && endInclusive === (availableEndExclusive - 1)
}

function formatXAxisLabel(valueMs: number) {
  if (!isAllRangeSelected()) return formatDayMonth(valueMs)

  const d = new Date(valueMs)
  if (d.getDate() !== 1) return ''
  const month = d.getMonth()
  return month % 2 === 0 ? `1.${month + 1}` : ''
}

function dayStartLocalMs(valueMs: number) {
  const d = new Date(valueMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function monthStartLocalMs(valueMs: number) {
  const d = new Date(valueMs)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d.getTime()
}

function currentDomainMs() {
  const data = primarySeries.value
  if (!data.length) return null
  const min = data[0][0]
  const max = data[data.length - 1][0]
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min, max }
}

function rangeDomainMs() {
  const start = rangeStartDate.value?.getTime()
  const end = rangeEndDateInclusive.value?.getTime()
  if (start == null || end == null) return null
  return { min: start, max: end }
}

function buildTickPositions(min: number, max: number) {
  const positions: number[] = []
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return positions

  const spanDays = (max - min) / DAY_MS
  const isYearRange = spanDays > 60
  const isMonthRange = spanDays >= 27 && spanDays <= 33

  if (isYearRange) {
    let t = monthStartLocalMs(min)
    if (t < min) {
      const d = new Date(t)
      d.setMonth(d.getMonth() + 1)
      t = d.getTime()
    }
    while (t <= max) {
      positions.push(t)
      const d = new Date(t)
      d.setMonth(d.getMonth() + 1)
      t = d.getTime()
    }
    return positions
  }

  if (isMonthRange) {
    let t = monthStartLocalMs(min)
    while (t < min) {
      const d = new Date(t)
      d.setDate(d.getDate() + 3)
      t = d.getTime()
    }
    while (t <= max) {
      positions.push(t)
      const d = new Date(t)
      d.setDate(d.getDate() + 3)
      t = d.getTime()
    }
    return positions
  }

  let t = dayStartLocalMs(min)
  while (t <= max) {
    positions.push(t)
    const d = new Date(t)
    d.setDate(d.getDate() + 1)
    t = d.getTime()
  }
  return positions
}

function startOfLocalDayMs(valueMs: number) {
  const d = new Date(valueMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function buildYearLabelPositions(min: number, max: number) {
  const positions: number[] = []
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return positions

  const startYear = new Date(min).getFullYear()
  const endYear = new Date(max).getFullYear()

  for (let year = startYear; year <= endYear; year += 1) {
    const yearStart = new Date(year, 0, 1).getTime()
    const nextYearStart = new Date(year + 1, 0, 1).getTime()
    const segmentStart = Math.max(min, yearStart)
    const segmentEnd = Math.min(max, nextYearStart - 1)
    if (segmentStart > segmentEnd) continue

    const juneFirst = new Date(year, 5, 1).getTime()
    const centerMs = startOfLocalDayMs((segmentStart + segmentEnd) / 2)
    const labelPos = juneFirst >= segmentStart && juneFirst <= segmentEnd ? juneFirst : centerMs
    positions.push(labelPos)
  }

  return positions
}

function yExtentWithPadding(seriesList: Array<Array<[number, number | null]>>) {
  let min: number | null = null
  let max: number | null = null
  for (const series of seriesList) {
    for (let i = 0; i < series.length; i += 1) {
      const v = series[i][1]
      if (v == null) continue
      if (min == null || v < min) min = v
      if (max == null || v > max) max = v
    }
  }
  if (min == null || max == null) return null
  const span = max - min || 1
  const pad = span * 0.05
  return { min: min - pad, max: max + pad }
}

const seriesName = computed(() => (props.mode === 'import' ? 'Import' : 'Export'))
const columnColor = computed(() => (props.mode === 'import' ? '#4fc3f7' : '#ff8a65'))

const primarySeries = computed(() => (props.mode === 'import' ? seriesImport.value : seriesExport.value))

let chart: Highcharts.Chart | null = null

let rafId: number | null = null
let pendingSeriesRefresh = false
let pendingExtremes: { start?: number; end?: number } | null = null

function refreshSeries() {
  if (!chart) return
  chart.series[0].setData(primarySeries.value, false, false, false)
  const extent = yExtentWithPadding([primarySeries.value as Array<[number, number | null]>])
  if (extent) {
    chart.yAxis[0].update(
      { min: 0, softMax: extent.max, startOnTick: false, endOnTick: false, minPadding: 0 },
      false
    )
  }
}

function scheduleFlush() {
  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (!chart) return

    let didWork = false

    if (pendingSeriesRefresh) {
      pendingSeriesRefresh = false
      refreshSeries()
      didWork = true
    }

    if (pendingExtremes) {
      const { start, end } = pendingExtremes
      pendingExtremes = null
      const axis = chart.xAxis[0]
      const same = (start == null || axis.min === start) && (end == null || axis.max === end)
      if (!same) {
        axis.setExtremes(start, end, false, false)
        didWork = true
      }
    }

    if (didWork) chart.redraw(false)
  })
}

function createChart() {
  chart = Highcharts.chart(chartId.value, {
    chart: {
      type: 'column',
      zooming: { type: 'x' }
    },
    title: { text: undefined },
    subtitle: { text: undefined },
    legend: { enabled: false },
    tooltip: {
      enabled: false
    },
    xAxis: [
      {
        type: 'datetime',
        labels: {
          formatter: function (this: Highcharts.AxisLabelsFormatterContextObject) {
            return formatXAxisLabel(this.value as number)
          },
          rotation: -45,
          reserveSpace: false,
          y: isAllRangeSelected() ? 8 : 6,
          style: { fontSize: '0.52rem' }
        },
        tickPositioner: function (this: Highcharts.Axis) {
          let min = Number.isFinite(this.min) ? this.min : undefined
          let max = Number.isFinite(this.max) ? this.max : undefined

          if (min == null || max == null) {
            const range = rangeDomainMs()
            if (range) {
              min = range.min
              max = range.max
            }
          }

          if (min == null || max == null) {
            const domain = currentDomainMs()
            if (domain) {
              min = domain.min
              max = domain.max
            }
          }

          if (min == null || max == null) return []
          return buildTickPositions(min, max)
        },
        crosshair: true
      },
      {
        linkedTo: 0,
        type: 'datetime',
        lineWidth: 0,
        tickLength: 0,
        gridLineWidth: 0,
        labels: {
          rotation: 0,
          y: -6,
          style: { color: '#999', fontWeight: '600', fontSize: '0.53rem' },
          formatter: function (this: Highcharts.AxisLabelsFormatterContextObject) {
            if (!isAllRangeSelected()) return ''
            return `${new Date(this.value as number).getFullYear()}`
          }
        },
        tickPositioner: function (this: Highcharts.Axis) {
          if (!isAllRangeSelected()) return []

          let min = Number.isFinite(this.min) ? this.min : undefined
          let max = Number.isFinite(this.max) ? this.max : undefined

          if (min == null || max == null) {
            const range = rangeDomainMs()
            if (range) {
              min = range.min
              max = range.max
            }
          }

          if (min == null || max == null) {
            const domain = currentDomainMs()
            if (domain) {
              min = domain.min
              max = domain.max
            }
          }

          if (min == null || max == null) return []
          return buildYearLabelPositions(min, max)
        }
      }
    ],
    yAxis: { title: { text: undefined }, min: 0, startOnTick: false, endOnTick: false, minPadding: 0, maxPadding: 0.02 },
    series: [
      {
        type: 'column',
        name: seriesName.value,
        data: primarySeries.value,
        color: columnColor.value,
        borderWidth: 0,
        pointPadding: 0.05
      }
    ]
  } as Highcharts.Options)
  registerHighCChart(chart, 'highcEnergy', (time: string, value: string) => {
    currentTime.value = time
    currentValue.value = value
  })
}

onMounted(() => {
  createChart()

  pendingSeriesRefresh = true
  pendingExtremes = {
    start: rangeStartDate.value?.getTime() ?? undefined,
    end: rangeEndDateInclusive.value?.getTime() ?? undefined
  }
  scheduleFlush()
})

watch([primarySeries], () => {
  pendingSeriesRefresh = true
  scheduleFlush()
})

watch([rangeStartDate, rangeEndDateInclusive], () => {
  pendingExtremes = {
    start: rangeStartDate.value?.getTime() ?? undefined,
    end: rangeEndDateInclusive.value?.getTime() ?? undefined
  }
  scheduleFlush()
})

defineExpose({
  currentTime,
  currentValue
})

onBeforeUnmount(() => {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (chart) {
    unregisterHighCChart(chart, 'highcEnergy')
    chart.destroy()
    chart = null
  }
})
</script>

<style scoped>
.chart-container {
  border-radius: inherit;
  display: block;
  overflow: hidden;
  height: 100%;
}

.chart-container > div {
  width: 100%;
  height: 100%;
}
</style>
