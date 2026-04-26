<template>
  <div class="solar-value-pie-chart">
    <div ref="chartRef" class="solar-value-pie-chart__canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Highcharts from '@/highcharts-theme'

interface Props {
  spotEnergyCents: number
  marginCents: number
  transferCents: number
  taxCents: number
  vatCents: number
  exportRevenueCents: number
}

const props = defineProps<Props>()

const chartRef = ref<HTMLElement | null>(null)
let chart: Highcharts.Chart | null = null
let resizeObserver: ResizeObserver | null = null

function toEuros(valueCents: number) {
  return Number((valueCents / 100).toFixed(2))
}

const seriesData = computed<Highcharts.PointOptionsObject[]>(() => [
  { name: 'Avoided spot price', y: toEuros(props.spotEnergyCents), color: '#3FA7FF' },
  { name: 'Avoided sales margin', y: toEuros(props.marginCents), color: '#7A86FF' },
  { name: 'Avoided transfer fee', y: toEuros(props.transferCents), color: '#64CFA0' },
  { name: 'Avoided energy tax', y: toEuros(props.taxCents), color: '#FFA726' },
  { name: 'Avoided VAT', y: toEuros(props.vatCents), color: '#AB47BC' },
  { name: 'Export revenue', y: toEuros(props.exportRevenueCents), color: '#2DBE7F' }
])

function createChart() {
  if (!chartRef.value) return

  chart = Highcharts.chart(chartRef.value, {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent'
    },
    title: { text: undefined },
    subtitle: { text: undefined },
    legend: {
      enabled: true,
      align: 'right',
      verticalAlign: 'middle',
      layout: 'vertical',
      symbolRadius: 6,
      itemStyle: { color: '#d7d7d7', fontSize: '0.72rem' }
    },
    tooltip: {
      useHTML: true,
      pointFormatter: function () {
        const value = Number(this.y || 0)
        const pct = Number(this.percentage || 0)
        return `<span style="color:${this.color}">\u25CF</span> ${this.name}: <b>${value.toFixed(2)} €</b> (${pct.toFixed(1)}%)`
      }
    },
    plotOptions: {
      pie: {
        dataLabels: { enabled: false },
        showInLegend: true,
        borderColor: '#111',
        borderWidth: 1,
        states: {
          hover: {
            enabled: true,
            halo: { size: 8 }
          }
        }
      }
    },
    series: [
      {
        type: 'pie',
        name: 'Solar value',
        innerSize: '0%',
        center: ['50%', '50%'],
        size: '86%',
        data: seriesData.value
      }
    ],
    credits: { enabled: false }
  } as Highcharts.Options)
}

function updateSeries() {
  if (!chart || !chart.series[0]) return
  chart.series[0].setData(seriesData.value, true, false, false)
}

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

watch(seriesData, () => {
  updateSeries()
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
.solar-value-pie-chart {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.solar-value-pie-chart__canvas {
  flex: 1;
  min-height: 0;
}
</style>
