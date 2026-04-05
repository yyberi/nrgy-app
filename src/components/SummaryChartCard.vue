<template>
  <GridTemplate title="Energy summary">
    <div class="summary-chart-card">
      <div class="chart-area">
        <component :is="currentChartComponent" />
      </div>
      <div class="chart-selector">
        <div class="btn-group btn-group-sm" role="group" aria-label="Chart type selection">
          <button
            v-for="option in chartOptions"
            :key="option.value"
            type="button"
            class="btn"
            :class="selectedChart === option.value ? 'btn-primary' : 'btn-outline-secondary'"
            @click="selectedChart = option.value"
          >{{ option.label }}</button>
        </div>
      </div>
    </div>
  </GridTemplate>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import GridTemplate from './GridTemplate.vue'
import DailyConsumptionChartHighC from './DailyConsumptionChartHighC.vue'

type ChartType = 'daily-consumption'

interface ChartOption {
  value: ChartType
  label: string
}

const chartOptions: ChartOption[] = [
  { value: 'daily-consumption', label: 'Total consumption' }
]

const selectedChart = ref<ChartType>('daily-consumption')

const currentChartComponent = computed(() => {
  switch (selectedChart.value) {
    case 'daily-consumption':
      return DailyConsumptionChartHighC
    default:
      return DailyConsumptionChartHighC
  }
})
</script>

<style scoped>
.summary-chart-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.5rem;
}

.chart-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-selector {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
  border-top: 1px solid #333;
}

.btn-group .btn {
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
}

.btn-group .btn.btn-outline-secondary {
  background-color: #1a1a1a;
  border-color: #555;
  color: #ccc;
}

.btn-group .btn.btn-outline-secondary:hover {
  background-color: #2a2a2a;
  color: #fff;
}

.btn-group .btn.btn-primary {
  background-color: #2a5a8a;
  border-color: #2a5a8a;
  color: #fff;
}
</style>
