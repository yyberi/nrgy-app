<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { GridLayout, GridItem } from 'vue-grid-layout-v3'
import '../node_modules/vue-grid-layout-v3/dist/index.css'
import Card from './components/Card.vue'
import GridTemplate from './components/GridTemplate.vue'
import PriceChartHighC from './components/PriceChartHighC.vue'
import SolarProductionChartHighC from './components/SolarProductionChartHighC.vue'
import MeterEnergyChartHighC from './components/MeterEnergyChartHighC.vue'
import SelfConsumptionChartHighC from './components/SelfConsumptionChartHighC.vue'
import SavedConsumptionChartHighC from './components/SavedConsumptionChartHighC.vue'
import SummarySection from './components/SummarySection.vue'
import DiagnosticsSettingsDialog from './components/DiagnosticsSettingsDialog.vue'
import TimeSelection from './components/TimeSelection.vue'
import TimeSelectionControls from './components/TimeSelectionControls.vue'
import nrgyIcon from '@/assets/img/nrgy.png'
import { useCombinedDataStore } from '@/stores/combined-data'
import { useTariffDataStore } from '@/stores/tariff-data'
import { useDashboardLayout } from '@/composables/useDashboardLayout'
import { useDataFormatting } from '@/composables/useDataFormatting'
import { useMainSummaryState } from '@/composables/useMainSummaryState'
import { useTariffCalculations } from '@/composables/useTariffCalculations'
import { inpDebugEnabled, interactionTimingRecords, setInpDebugEnabled } from '@/composables/inpDebug'

// Stores
const combinedStore = useCombinedDataStore()
const tariffStore = useTariffDataStore()
const {
  seriesPrice: priceSeriesData,
  seriesSolar: solarSeriesData,
  seriesExport,
  avgPrice,
  totalSolar: solarTotal,
  totalSelfConsumption,
  totalSavedConsumption,
  totalImport,
  totalExport,
  totalImportNet,
  totalExportNet,
  hasNetting,
  bestProductionMonth,
  bestProductionDay,
  bestProductionHour,
  bestSelfConsMonth,
  rangeStartDate,
  rangeEndDateInclusive,
  points
} = storeToRefs(combinedStore)
const { loaded: tariffLoaded } = storeToRefs(tariffStore)

// Composables
const { rowHeight, dashboardLayout, dashboardLayoutById } = useDashboardLayout()
const { formatEnergy, formatCurrency, formatDateInput, buildSubtitle } = useDataFormatting()

// Spot price map for tariff calculations
const spotPriceByHour = computed(() => {
  const map = new Map<number, number | null>()
  for (const [timestampMs, price] of priceSeriesData.value) {
    map.set(timestampMs, price)
  }
  return map
})

const {
  exportRevenueBreakdown,
  savedConsumptionValueBreakdown
} = useTariffCalculations(points, spotPriceByHour)

// Data point counts
const pricePointCount = computed(() => priceSeriesData.value.length)
const solarPointCount = computed(() => solarSeriesData.value.length)
const meterPointCount = computed(() => points.value.length)

// Display values - Energy
const priceAverageDisplay = computed(() =>
  pricePointCount.value ? `${avgPrice.value.toFixed(2)} c/kWh` : '—'
)

const solarTotalDisplay = computed(() =>
  solarPointCount.value ? `${solarTotal.value.toFixed(2)} kWh` : '—'
)

const selfConsumptionTotalDisplay = computed(() =>
  meterPointCount.value ? `${totalSelfConsumption.value.toFixed(2)} kWh` : '—'
)

const savedConsumptionTotalDisplay = computed(() =>
  meterPointCount.value ? `${totalSavedConsumption.value.toFixed(2)} kWh` : '—'
)

const meterExportTotalDisplay = computed(() =>
  meterPointCount.value ? formatEnergy(totalExport.value) : '—'
)

const avoidedConsumptionEnergyDisplay = computed(() =>
  meterPointCount.value ? formatEnergy(totalSavedConsumption.value) : '—'
)

const meterExportNetDisplay = computed(() =>
  hasNetting.value ? formatEnergy(totalExportNet.value) : '—'
)

const exportRevenueTotalDisplay = computed(() =>
  exportRevenueBreakdown.value ? formatCurrency(exportRevenueBreakdown.value.revenueCents) : '—'
)

const savedConsumptionValueTotalDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.totalCents) : '—'
)

const savedConsumptionSpotDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.spotEnergyCents) : '—'
)

const savedConsumptionMarginDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.marginCents) : '—'
)

const savedConsumptionTransferDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.transferCents) : '—'
)

const savedConsumptionTaxDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.taxCents) : '—'
)

const savedConsumptionVatDisplay = computed(() =>
  savedConsumptionValueBreakdown.value ? formatCurrency(savedConsumptionValueBreakdown.value.vatCents) : '—'
)

// Chart refs
const priceChartRef = ref<InstanceType<typeof PriceChartHighC>>()
const solarChartRef = ref<InstanceType<typeof SolarProductionChartHighC>>()
const importChartRef = ref<InstanceType<typeof MeterEnergyChartHighC>>()
const exportChartRef = ref<InstanceType<typeof MeterEnergyChartHighC>>()
const selfConsChartRef = ref<InstanceType<typeof SelfConsumptionChartHighC>>()
const savedConsChartRef = ref<InstanceType<typeof SavedConsumptionChartHighC>>()
const timeSelectionRef = ref<InstanceType<typeof TimeSelection>>()

const showPerfSettings = ref(false)
const inpDebugEnabledModel = computed({
  get: () => inpDebugEnabled.value,
  set: (value: boolean) => setInpDebugEnabled(value)
})
const interactionTimingRows = computed(() => interactionTimingRecords.value)

function openPerfSettings() {
  showPerfSettings.value = true
}

function closePerfSettings() {
  showPerfSettings.value = false
}

const {
  summaryView,
  summaryViewOptions,
  summaryChartAggregation,
  summaryChartAggregationOverride,
  isMultiYearRange,
  hourlySelectedMetrics,
  hourlyMetricOptions,
  summaryPanelTitle,
  toggleHourlyMetric,
  importedSummaryPage,
  importedSummaryPagesForView,
  importedConsumptionTotal,
  summaryTotalHeaderDisplay,
  hourlyHighlights,
  exportSummaryMeta,
  solarValueSummary
} = useMainSummaryState({
  points,
  rangeStartDate,
  rangeEndDateInclusive,
  tariffLoaded,
  tariffStore,
  hasNetting,
  totalImport,
  totalSelfConsumption,
  totalExport,
  solarTotal,
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
})

// Range label and subtitles
const rangeLabel = computed(() => {
  const start = rangeStartDate.value
  const end = rangeEndDateInclusive.value
  if (!start || !end) return 'Select a range'
  return `${formatDateInput(start)} → ${formatDateInput(end)}`
})

const meterExportSummarySubtitle = computed(() => buildSubtitle('kWh', rangeLabel.value, seriesExport.value.length))
const gridImportChartTitle = computed(() => {
  if (!meterPointCount.value) return 'Grid import (kWh)'
  const title = `Grid import ${formatEnergy(totalImport.value)}`
  if (!hasNetting.value) return title
  return `${title}\nNet ${formatEnergy(totalImportNet.value)}`
})
const gridExportChartTitle = computed(() => {
  if (!meterPointCount.value) return 'Grid export (kWh)'
  const title = `Grid export ${formatEnergy(totalExport.value)}`
  if (!hasNetting.value) return title
  return `${title}\nNet ${formatEnergy(totalExportNet.value)}`
})
</script>

<template>
  <div class="main-page">
    <Card title="Energy data" layout="vertical">
      <template #title>
        <button
          type="button"
          class="main-card-logo-button"
          aria-label="Open diagnostics settings"
          @click="openPerfSettings"
        >
          <img :src="nrgyIcon" class="main-card-logo" alt="Nrgy" />
        </button>
      </template>
      <template #actions>
        <GridTemplate title="Time selection">
          <template #header>
            <div v-if="timeSelectionRef" class="time-selection-header-slot">
              <span class="time-selection-range-label">{{ timeSelectionRef.selectedRangeLabel }}</span>
              <div class="time-selection-header-controls">
                <TimeSelectionControls
                  :duration="timeSelectionRef.duration"
                  :selected-year="timeSelectionRef.selectedYear"
                  :duration-options="timeSelectionRef.durationOptions"
                  :year-options="timeSelectionRef.yearOptions"
                  :range-ready="timeSelectionRef.rangeReady"
                  :timeline-ready="timeSelectionRef.timelineReady"
                  @duration-change="timeSelectionRef.handleDurationChange"
                  @year-change="timeSelectionRef.handleYearChange"
                  @reset="timeSelectionRef.resetAllHighCharts"
                />
              </div>
            </div>
          </template>
          <TimeSelection ref="timeSelectionRef" />
        </GridTemplate>
      </template>
      <GridLayout
        class="dashboard-grid"
        :layout="dashboardLayout"
        :col-num="12"
        :row-height="rowHeight"
        :is-draggable="false"
        :is-resizable="false"
        :is-mirrored="false"
        :margin="[6, 6]"
      >
        <GridItem v-bind="dashboardLayoutById['solar-chart']" :key="'solar-chart'">
          <GridTemplate :title="`PV production — ${solarTotalDisplay}`">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ solarChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ solarChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <SolarProductionChartHighC ref="solarChartRef" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['import-chart']" :key="'import-chart'">
          <GridTemplate :title="gridImportChartTitle">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ importChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ importChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <MeterEnergyChartHighC mode="import" ref="importChartRef" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['chart-5']" :key="'chart-5'">
          <GridTemplate :title="`Self consumption (kWh) — ${selfConsumptionTotalDisplay}`">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ selfConsChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ selfConsChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <SelfConsumptionChartHighC ref="selfConsChartRef" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['price-chart']" :key="'price-chart'">
          <GridTemplate :title="`Spot price — avg ${priceAverageDisplay}`">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ priceChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ priceChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <PriceChartHighC ref="priceChartRef" :averagePrice="avgPrice" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['export-chart']" :key="'export-chart'">
          <GridTemplate :title="gridExportChartTitle">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ exportChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ exportChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <MeterEnergyChartHighC mode="export" ref="exportChartRef" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['chart-6']" :key="'chart-6'">
          <GridTemplate :title="`Avoided purchase — ${savedConsumptionTotalDisplay}`">
            <template #header>
              <div class="chart-info">
                <div class="info-time">{{ savedConsChartRef?.currentTime || '\u00A0' }}</div>
                <div class="info-value">{{ savedConsChartRef?.currentValue || '\u00A0' }}</div>
              </div>
            </template>
            <SavedConsumptionChartHighC ref="savedConsChartRef" />
          </GridTemplate>
        </GridItem>
        <GridItem v-bind="dashboardLayoutById['summary']" :key="'summary'">
          <SummarySection
            :range-label="rangeLabel"
            :summary-panel-title="summaryPanelTitle"
            :summary-view="summaryView"
            :summary-view-options="summaryViewOptions"
            :is-multi-year-range="isMultiYearRange"
            :summary-chart-aggregation="summaryChartAggregation"
            :summary-chart-aggregation-override="summaryChartAggregationOverride"
            :hourly-metric-options="hourlyMetricOptions"
            :hourly-selected-metrics="hourlySelectedMetrics"
            :imported-summary-pages-for-view="importedSummaryPagesForView"
            :imported-summary-page="importedSummaryPage"
            :summary-total-header-display="summaryTotalHeaderDisplay"
            :imported-consumption-total="importedConsumptionTotal"
            :total-import="totalImport"
            :total-self-consumption="totalSelfConsumption"
            :total-export="totalExport"
            :solar-total="solarTotal"
            :saved-consumption-value-breakdown="savedConsumptionValueBreakdown"
            :export-revenue-breakdown="exportRevenueBreakdown"
            :best-production-month="bestProductionMonth"
            :best-production-day="bestProductionDay"
            :best-production-hour="bestProductionHour"
            :best-self-cons-month="bestSelfConsMonth"
            :hourly-highlights="hourlyHighlights"
            :solar-value-summary="solarValueSummary"
            :meter-export-summary-subtitle="meterExportSummarySubtitle"
            :meter-export-total-display="meterExportTotalDisplay"
            :export-summary-meta="exportSummaryMeta"
            @update:summary-view="summaryView = $event"
            @update:summary-chart-aggregation="summaryChartAggregation = $event"
            @toggle-hourly-metric="toggleHourlyMetric"
            @update:imported-summary-page="importedSummaryPage = $event"
          />
        </GridItem>
      </GridLayout>
    </Card>

    <DiagnosticsSettingsDialog
      :open="showPerfSettings"
      v-model:enabled="inpDebugEnabledModel"
      :rows="interactionTimingRows"
      @close="closePerfSettings"
    />
  </div>
</template>

<style scoped lang="scss" src="./scss/main-page.scss"></style>
