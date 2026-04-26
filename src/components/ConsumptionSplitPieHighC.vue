<template>
  <div class="consumption-pie-chart">
    <div ref="chartRef" class="consumption-pie-chart__canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Highcharts from '@/highcharts-theme'

interface Props {
  imported: number
  selfConsumption: number
  total?: number
}

const props = defineProps<Props>()

const chartRef = ref<HTMLElement | null>(null)
let chart: Highcharts.Chart | null = null
let resizeObserver: ResizeObserver | null = null
type CenterLabelChart = Highcharts.Chart & {
  customTotalLabel?: Highcharts.SVGElement
  customTotalValue?: Highcharts.SVGElement
  customTotalUnit?: Highcharts.SVGElement
}

const totalValue = computed(() => props.total ?? (props.imported + props.selfConsumption))

const seriesData = computed<Highcharts.PointOptionsObject[]>(() => [
  { name: 'Imported', y: props.imported, color: '#3FA7FF' },
  { name: 'Self sufficiency (SSR)', y: props.selfConsumption, color: '#2DBE7F' }
])

function createChart() {
  if (!chartRef.value) return

  chart = Highcharts.chart(chartRef.value, {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      events: {
        render: function () {
          const c = this as CenterLabelChart
          const centerX = c.plotLeft + c.plotWidth / 2
          const centerY = c.plotTop + c.plotHeight / 2
          if (c.customTotalLabel) c.customTotalLabel.destroy()
          if (c.customTotalValue) c.customTotalValue.destroy()
          if (c.customTotalUnit) c.customTotalUnit.destroy()
          c.customTotalLabel = c.renderer
            .text('Total', centerX, centerY - 12, false)
            .css({ color: '#aaa', fontSize: '0.8rem', fontWeight: '400', textAnchor: 'middle' })
            .attr({ align: 'center', zIndex: 5 })
            .add()
          c.customTotalValue = c.renderer
            .text(`${totalValue.value.toFixed(2)}`, centerX, centerY + 8, false)
            .css({ color: '#fff', fontSize: '0.95rem', fontWeight: '700', textAnchor: 'middle' })
            .attr({ align: 'center', zIndex: 5 })
            .add()
          c.customTotalUnit = c.renderer
            .text('kWh', centerX, centerY + 24, false)
            .css({ color: '#aaa', fontSize: '0.7rem', fontWeight: '400', textAnchor: 'middle' })
            .attr({ align: 'center', zIndex: 5 })
            .add()
        }
      }
    },
    title: { text: undefined },
    subtitle: { text: undefined },
    legend: { enabled: false },
    tooltip: {
      useHTML: true,
      pointFormatter: function () {
        const value = Number(this.y || 0)
        const pct = Number(this.percentage || 0)
        return `<span style="color:${this.color}">\u25CF</span> ${this.name}: <b>${value.toFixed(2)} kWh</b> (${pct.toFixed(1)}%)`
      }
    },
    plotOptions: {
      pie: {
        dataLabels: {
          enabled: true,
          format: '<span style="font-weight:700">{point.name}</span><br/>{point.y:.2f} kWh ({point.percentage:.1f}%)',
          style: { color: '#d7d7d7', fontSize: '0.82rem', textOutline: 'none', fontWeight: '400' },
          connectorColor: '#666',
          connectorWidth: 1,
          distance: 20
        },
        showInLegend: false,
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
        name: 'Consumption',
        innerSize: '62%',
        center: ['50%', '50%'],
        size: '90%',
        data: seriesData.value
      }
    ],
    credits: { enabled: false }
  } as Highcharts.Options)
}

function updateSeries() {
  if (!chart || !chart.series[0]) return
  chart.series[0].setData(seriesData.value, true, false, false)
  chart.redraw()
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
.consumption-pie-chart {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.consumption-pie-chart__canvas {
  flex: 1;
  min-height: 0;
}
</style>
