<template>
  <GridTemplate class="summary-template" title="Summary" :subtitle="rangeLabel">
    <div class="summary-panels">
      <section class="summary-panel summary-panel--chart">
        <header class="summary-panel-header">
          <h4 class="summary-panel-title">{{ summaryPanelTitle }}</h4>
          <div
            v-if="isMultiYearRange && summaryView !== 'hourly-value'"
            class="btn-group btn-group-sm summary-chart-agg-toggle"
            role="group"
            aria-label="Aggregation mode"
          >
            <button
              type="button"
              class="btn"
              :class="summaryChartAggregation === 'month' ? 'btn-primary' : 'btn-outline-secondary'"
              @click="emit('update:summaryChartAggregation', 'month')"
            >Months</button>
            <button
              type="button"
              class="btn"
              :class="summaryChartAggregation === 'year' ? 'btn-primary' : 'btn-outline-secondary'"
              @click="emit('update:summaryChartAggregation', 'year')"
            >Years</button>
          </div>
          <div
            v-if="summaryView === 'hourly-value'"
            class="btn-group btn-group-sm summary-chart-agg-toggle"
            role="group"
            aria-label="Hourly summary mode"
          >
            <button
              v-for="option in hourlyMetricOptions"
              :key="option.value"
              type="button"
              class="btn"
              :class="hourlySelectedMetrics.includes(option.value) ? 'btn-primary' : 'btn-outline-secondary'"
              @click="emit('toggle-hourly-metric', option.value)"
            >{{ option.label }}</button>
          </div>
        </header>
        <div class="summary-panel-content">
          <div v-show="summaryView === 'total-consumption'" class="summary-chart-view">
            <DailyConsumptionChartHighC :aggregation-override="summaryChartAggregationOverride" />
          </div>
          <div v-show="summaryView === 'solar-production'" class="summary-chart-view">
            <SolarProductionStackedChartHighC :aggregation-override="summaryChartAggregationOverride" />
          </div>
          <div v-show="summaryView === 'hourly-value'" class="summary-chart-view">
            <SolarValueByHourChartHighC :selected-metrics="hourlySelectedMetrics" />
          </div>
          <div v-show="summaryView === 'solar-value'" class="summary-chart-view">
            <SolarValueStackedChartHighC :aggregation-override="summaryChartAggregationOverride" />
          </div>
        </div>
      </section>

      <SummaryPanelCard
        class="summary-panel summary-panel--import"
        title="Total"
        :pages="importedSummaryPagesForView"
        :active-page="importedSummaryPage"
        @update:active-page="handleImportedSummaryPageUpdate"
      >
        <template #header-center>
          <p class="summary-panel-total-header">{{ summaryTotalHeaderDisplay }}</p>
        </template>

        <template #page-consumption>
          <div v-show="summaryView === 'total-consumption'" class="imported-pie-page">
            <ConsumptionSplitPieHighC
              :imported="totalImport"
              :self-consumption="totalSelfConsumption"
              :total="importedConsumptionTotal"
            />
          </div>
          <div v-show="summaryView === 'solar-production'" class="imported-pie-page">
            <SolarProductionSplitPieHighC
              :exported="totalExport"
              :self-consumption="totalSelfConsumption"
              :total="solarTotal"
            />
          </div>
          <div v-show="summaryView === 'solar-value'" class="imported-pie-page">
            <SolarValueSplitPieHighC
              :spot-energy-cents="savedConsumptionValueBreakdown?.spotEnergyCents ?? 0"
              :margin-cents="savedConsumptionValueBreakdown?.marginCents ?? 0"
              :transfer-cents="savedConsumptionValueBreakdown?.transferCents ?? 0"
              :tax-cents="savedConsumptionValueBreakdown?.taxCents ?? 0"
              :vat-cents="savedConsumptionValueBreakdown?.vatCents ?? 0"
              :export-revenue-cents="exportRevenueBreakdown?.revenueCents ?? 0"
            />
          </div>
          <div v-show="summaryView === 'hourly-value'" class="imported-pie-page">
            <ValueSplitPieHighC
              :avoided-cents="savedConsumptionValueBreakdown?.totalCents ?? 0"
              :export-revenue-cents="exportRevenueBreakdown?.revenueCents ?? 0"
            />
          </div>
        </template>
      </SummaryPanelCard>

      <section class="summary-panel summary-panel--export">
        <div v-show="summaryView === 'solar-production'" class="summary-section-view">
          <header class="summary-panel-header">
            <h4 class="summary-panel-title">Peak records</h4>
          </header>
          <div class="summary-panel-content summary-panel-content--stats">
            <div class="pv-peaks-grid" v-if="bestProductionMonth || bestProductionDay || bestProductionHour || bestSelfConsMonth">
              <template v-if="bestProductionMonth">
                <span class="pv-peaks-label">Best month</span>
                <span class="pv-peaks-value">{{ bestProductionMonth.label }}</span>
                <span class="pv-peaks-detail">{{ bestProductionMonth.value.toFixed(1) }} kWh</span>
              </template>
              <template v-if="bestProductionDay">
                <span class="pv-peaks-label">Best day</span>
                <span class="pv-peaks-value">{{ bestProductionDay.label }}</span>
                <span class="pv-peaks-detail">{{ bestProductionDay.value.toFixed(2) }} kWh</span>
              </template>
              <template v-if="bestProductionHour">
                <span class="pv-peaks-label">Best hour</span>
                <span class="pv-peaks-value">{{ bestProductionHour.label }}</span>
                <span class="pv-peaks-detail">{{ bestProductionHour.value.toFixed(3) }} kWh</span>
              </template>
              <template v-if="bestSelfConsMonth">
                <span class="pv-peaks-label">Best self cons.</span>
                <span class="pv-peaks-value">{{ bestSelfConsMonth.label }}</span>
                <span class="pv-peaks-detail">{{ bestSelfConsMonth.value.toFixed(1) }} kWh</span>
              </template>
            </div>
          </div>
        </div>
        <div v-show="summaryView === 'hourly-value'" class="summary-section-view">
          <header class="summary-panel-header">
            <h4 class="summary-panel-title">Hourly highlights</h4>
          </header>
          <div class="summary-panel-content summary-panel-content--stats">
            <div v-if="hourlyHighlights" class="pv-peaks-grid">
              <span class="pv-peaks-label">Best value hour</span>
              <span class="pv-peaks-value">{{ hourlyHighlights.bestValueHourLabel }}</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.bestValueTotalDisplay }}</span>

              <span class="pv-peaks-label">Best hour export</span>
              <span class="pv-peaks-value">Export</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.bestValueExportDisplay }}</span>

              <span class="pv-peaks-label">Best hour avoided</span>
              <span class="pv-peaks-value">Avoided</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.bestValueAvoidedDisplay }}</span>

              <span class="pv-peaks-label">Best PV hour</span>
              <span class="pv-peaks-value">{{ hourlyHighlights.bestPvHourLabel }}</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.bestPvValueDisplay }}</span>

              <span class="pv-peaks-label">Highest spot</span>
              <span class="pv-peaks-value">{{ hourlyHighlights.highestSpotHourLabel }}</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.highestSpotDisplay }}</span>

              <span class="pv-peaks-label">Lowest spot</span>
              <span class="pv-peaks-value">{{ hourlyHighlights.lowestSpotHourLabel }}</span>
              <span class="pv-peaks-detail">{{ hourlyHighlights.lowestSpotDisplay }}</span>
            </div>
            <p v-else class="summary-meta">No hourly highlights available.</p>
          </div>
        </div>
        <div v-show="summaryView === 'solar-value'" class="summary-section-view summary-section-view--solar-value">
          <header class="summary-panel-header">
            <h4 class="summary-panel-title">Solar value overview</h4>
          </header>
          <div class="summary-panel-content summary-panel-content--stats solar-value-summary">
            <div class="solar-value-summary__energy-grid">
              <span class="solar-value-summary__energy-label">Sold energy</span>
              <span class="solar-value-summary__energy-value">{{ solarValueSummary.meterExportTotalDisplay }}</span>
              <span class="solar-value-summary__energy-label">Avoided consumption</span>
              <span class="solar-value-summary__energy-value">{{ solarValueSummary.avoidedConsumptionEnergyDisplay }}</span>
              <template v-if="solarValueSummary.hasNetting">
                <span class="solar-value-summary__energy-label">Netted export</span>
                <span class="solar-value-summary__energy-value">{{ solarValueSummary.meterExportNetDisplay }}</span>
              </template>
            </div>

            <div class="solar-value-summary__value-grid">
              <span class="solar-value-summary__value-label">Export revenue</span>
              <span class="solar-value-summary__value-amount">{{ solarValueSummary.exportRevenueTotalDisplay }}</span>
              <span class="solar-value-summary__value-label">Avoided consumption value</span>
              <span class="solar-value-summary__value-amount">{{ solarValueSummary.savedConsumptionValueTotalDisplay }}</span>
              <span class="solar-value-summary__value-label solar-value-summary__value-label--sub">Avoided spot price</span>
              <span class="solar-value-summary__value-amount solar-value-summary__value-amount--sub">{{ solarValueSummary.savedConsumptionSpotDisplay }}</span>
              <span class="solar-value-summary__value-label solar-value-summary__value-label--sub">Avoided sales margin</span>
              <span class="solar-value-summary__value-amount solar-value-summary__value-amount--sub">{{ solarValueSummary.savedConsumptionMarginDisplay }}</span>
              <span class="solar-value-summary__value-label solar-value-summary__value-label--sub">Avoided transfer fee</span>
              <span class="solar-value-summary__value-amount solar-value-summary__value-amount--sub">{{ solarValueSummary.savedConsumptionTransferDisplay }}</span>
              <span class="solar-value-summary__value-label solar-value-summary__value-label--sub">Avoided energy tax</span>
              <span class="solar-value-summary__value-amount solar-value-summary__value-amount--sub">{{ solarValueSummary.savedConsumptionTaxDisplay }}</span>
              <span class="solar-value-summary__value-label solar-value-summary__value-label--sub">Avoided VAT</span>
              <span class="solar-value-summary__value-amount solar-value-summary__value-amount--sub">{{ solarValueSummary.savedConsumptionVatDisplay }}</span>
            </div>
          </div>
        </div>
        <div
          v-show="summaryView !== 'solar-production' && summaryView !== 'hourly-value' && summaryView !== 'solar-value'"
          class="summary-section-view"
        >
          <header class="summary-panel-header">
            <h4 class="summary-panel-title">Exported energy</h4>
            <p class="summary-panel-subtitle">{{ meterExportSummarySubtitle }}</p>
          </header>
          <div class="summary-panel-content summary-panel-content--stats">
            <p class="summary-value">{{ meterExportTotalDisplay }}</p>
            <p
              v-for="(meta, index) in exportSummaryMeta"
              :key="`export-${index}`"
              class="summary-meta"
              :class="{ 'summary-section': meta.isSection }"
            >
              {{ meta.label }}: {{ meta.value }}
            </p>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="summary-footer">
        <div class="btn-group btn-group-sm" role="group" aria-label="Summary view selection">
          <button
            v-for="option in summaryViewOptions"
            :key="option.value"
            type="button"
            class="btn"
            :class="summaryView === option.value ? 'btn-primary' : 'btn-outline-secondary'"
            @click="emit('update:summaryView', option.value)"
          >{{ option.label }}</button>
        </div>
      </div>
    </template>
  </GridTemplate>
</template>

<script setup lang="ts">
import GridTemplate from './GridTemplate.vue'
import DailyConsumptionChartHighC from './DailyConsumptionChartHighC.vue'
import ConsumptionSplitPieHighC from './ConsumptionSplitPieHighC.vue'
import SolarValueStackedChartHighC from './SolarValueStackedChartHighC.vue'
import SolarValueByHourChartHighC from './SolarValueByHourChartHighC.vue'
import SolarValueSplitPieHighC from './SolarValueSplitPieHighC.vue'
import ValueSplitPieHighC from './ValueSplitPieHighC.vue'
import SolarProductionStackedChartHighC from './SolarProductionStackedChartHighC.vue'
import SolarProductionSplitPieHighC from './SolarProductionSplitPieHighC.vue'
import SummaryPanelCard from './SummaryPanelCard.vue'
import type { MetaItem, SummaryPanelPage } from '@/types/ui-summary'
import type { RevenueBreakdown, SavedConsumptionBreakdown } from '@/composables/useTariffCalculations'
import type {
  HourlyHighlights,
  HourlyMetric,
  SolarChartAggregation,
  SummaryView
} from '@/composables/useMainSummaryState'

interface PeakRecord {
  label: string
  value: number
}

interface SolarValueSummaryDisplay {
  meterExportTotalDisplay: string
  avoidedConsumptionEnergyDisplay: string
  meterExportNetDisplay: string
  exportRevenueTotalDisplay: string
  savedConsumptionValueTotalDisplay: string
  savedConsumptionSpotDisplay: string
  savedConsumptionMarginDisplay: string
  savedConsumptionTransferDisplay: string
  savedConsumptionTaxDisplay: string
  savedConsumptionVatDisplay: string
  hasNetting: boolean
}

interface Props {
  rangeLabel: string
  summaryPanelTitle: string
  summaryView: SummaryView
  summaryViewOptions: Array<{ value: SummaryView; label: string }>
  isMultiYearRange: boolean
  summaryChartAggregation: SolarChartAggregation
  summaryChartAggregationOverride: SolarChartAggregation | null
  hourlyMetricOptions: Array<{ value: HourlyMetric; label: string }>
  hourlySelectedMetrics: HourlyMetric[]
  importedSummaryPagesForView: SummaryPanelPage[]
  importedSummaryPage: 'consumption'
  summaryTotalHeaderDisplay: string
  importedConsumptionTotal: number
  totalImport: number
  totalSelfConsumption: number
  totalExport: number
  solarTotal: number
  savedConsumptionValueBreakdown: SavedConsumptionBreakdown | null
  exportRevenueBreakdown: RevenueBreakdown | null
  bestProductionMonth: PeakRecord | null
  bestProductionDay: PeakRecord | null
  bestProductionHour: PeakRecord | null
  bestSelfConsMonth: PeakRecord | null
  hourlyHighlights: HourlyHighlights | null
  solarValueSummary: SolarValueSummaryDisplay
  meterExportSummarySubtitle: string
  meterExportTotalDisplay: string
  exportSummaryMeta: MetaItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  'update:summaryView': [value: SummaryView]
  'update:summaryChartAggregation': [value: SolarChartAggregation]
  'toggle-hourly-metric': [value: HourlyMetric]
  'update:importedSummaryPage': [value: 'consumption']
}>()

function handleImportedSummaryPageUpdate(page: string) {
  emit('update:importedSummaryPage', page as 'consumption')
}
</script>

<style scoped>
.summary-panels {
  height: 100%;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0.5rem;
  min-height: 0;
}

.summary-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
  border-radius: 8px;
  background: #151515;
  padding: 0.5rem;
}

.summary-panel-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.summary-chart-agg-toggle .btn {
  font-size: 0.68rem;
  padding: 0.15rem 0.5rem;
}

.summary-chart-agg-toggle .btn.btn-outline-secondary {
  background-color: #1a1a1a;
  border-color: #555;
  color: #ccc;
}

.summary-chart-agg-toggle .btn.btn-outline-secondary:hover {
  background-color: #2a2a2a;
  color: #fff;
}

.summary-chart-agg-toggle .btn.btn-primary {
  background-color: #2a5a8a;
  border-color: #2a5a8a;
  color: #fff;
}

.summary-panel-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ad0ff;
}

.summary-panel-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: #a6c7ff;
}

.summary-panel-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.summary-panel-content > * {
  flex: 1;
  min-height: 0;
}

.summary-chart-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.summary-chart-view > * {
  flex: 1;
  min-height: 0;
}

.summary-section-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.summary-panel-content--stats {
  gap: 0.35rem;
  overflow: auto;
}

.imported-pie-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.summary-panel-total-header {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #ffffff;
}

.summary-value {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
  word-break: break-word;
}

.summary-meta {
  font-size: 0.85rem;
  color: #c0c0c0;
  margin: 0;
}

.pv-peaks-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.3rem 0.7rem;
  font-size: 0.9rem;
  color: #c0c0c0;
  align-items: baseline;
}

.pv-peaks-label {
  color: #f0c040;
  white-space: nowrap;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pv-peaks-value {
  font-weight: 600;
  color: #e0e0e0;
  font-size: 0.95rem;
}

.pv-peaks-detail {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #bbb;
  font-size: 0.9rem;
}

.summary-section {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.summary-section-view--solar-value .summary-panel-header {
  margin-bottom: 0.45rem;
}

.summary-section-view--solar-value .summary-panel-content--stats {
  overflow: hidden;
  gap: 0.2rem;
}

.solar-value-summary {
  gap: 0.45rem;
}

.solar-value-summary__energy-grid,
.solar-value-summary__value-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.16rem 0.55rem;
  align-items: baseline;
}

.solar-value-summary__energy-grid {
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.solar-value-summary__energy-label,
.solar-value-summary__value-label {
  margin: 0;
  color: #cfd7e1;
  font-size: 0.76rem;
  line-height: 1.12;
}

.solar-value-summary__energy-value,
.solar-value-summary__value-amount {
  margin: 0;
  color: #ffffff;
  font-size: 0.84rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  line-height: 1.12;
}

.solar-value-summary__value-label--sub {
  color: #aeb8c4;
  font-size: 0.73rem;
}

.solar-value-summary__value-amount--sub {
  color: #d7dde5;
  font-size: 0.76rem;
  font-weight: 550;
}

.summary-footer {
  display: flex;
  justify-content: center;
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

:deep(.summary-template .grid-template__heading) {
  flex-direction: row;
  align-items: baseline;
  gap: 0.75rem;
}

:deep(.summary-template .grid-template__subtitle) {
  white-space: nowrap;
}

@media (max-width: 1360px) {
  .summary-panels {
    grid-template-columns: 1.45fr 1fr 1fr;
  }

  .summary-value {
    font-size: 1.35rem;
  }
}

@media (max-width: 1120px) {
  .summary-panels {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "chart chart"
      "import export";
  }

  .summary-panel--chart {
    grid-area: chart;
  }

  .summary-panel--import {
    grid-area: import;
  }

  .summary-panel--export {
    grid-area: export;
  }

  :deep(.summary-template .grid-template__heading) {
    flex-wrap: wrap;
    gap: 0.3rem 0.75rem;
  }

  :deep(.summary-template .grid-template__subtitle) {
    white-space: normal;
  }
}

@media (max-width: 820px) {
  .summary-panels {
    grid-template-columns: 1fr;
    grid-template-areas:
      "chart"
      "import"
      "export";
  }

  .summary-value {
    font-size: 1.2rem;
  }

  .summary-meta {
    font-size: 0.8rem;
  }

  .summary-footer .radio-button-group {
    flex-wrap: wrap;
    overflow: visible;
    justify-content: center;
  }
}
</style>
