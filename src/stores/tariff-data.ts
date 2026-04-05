import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { TariffConfig } from '@/tariffs/types'
import { buildTariffIndex, getComponentValueAt, type TariffConfigIndex } from '@/tariffs/config'

const GRID_URL = '/tariffs/grid-elenia.json'
const RETAIL_URL = '/tariffs/retail-seinajoki-energia.json'
const VAT_URL = '/tariffs/vat-fi.json'

async function loadConfig(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as TariffConfig
}

export const useTariffDataStore = defineStore('tariffData', () => {
  const grid = ref<TariffConfigIndex | null>(null)
  const retail = ref<TariffConfigIndex | null>(null)
  const vat = ref<TariffConfigIndex | null>(null)

  const retailPricingMode = ref<'spot' | 'fixed'>('spot')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  async function loadAll() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const [gridConfig, retailConfig, vatConfig] = await Promise.all([
        loadConfig(GRID_URL),
        loadConfig(RETAIL_URL),
        loadConfig(VAT_URL)
      ])
      grid.value = buildTariffIndex(gridConfig)
      retail.value = buildTariffIndex(retailConfig)
      vat.value = buildTariffIndex(vatConfig)
      loaded.value = true
    } catch (e: any) {
      error.value = `Failed to load tariff config: ${e.message || e}`
      console.error('[tariffData] load error', e)
    } finally {
      loading.value = false
    }
  }

  function getGridValueAt(componentId: string, timestampMs: number) {
    if (!grid.value) return null
    return getComponentValueAt(grid.value, componentId, timestampMs)
  }

  function getRetailValueAt(componentId: string, timestampMs: number) {
    if (!retail.value) return null
    return getComponentValueAt(retail.value, componentId, timestampMs)
  }

  function setRetailPricingMode(mode: 'spot' | 'fixed') {
    retailPricingMode.value = mode
  }

  function getRetailEnergyPriceAt(timestampMs: number, spotPriceCentsPerKwh: number | null) {
    if (retailPricingMode.value === 'fixed') {
      return getRetailValueAt('fixed_price', timestampMs)
    }
    return spotPriceCentsPerKwh
  }

  function getVatRateAt(timestampMs: number) {
    if (!vat.value) return null
    return getComponentValueAt(vat.value, 'vat', timestampMs)
  }

  loadAll()

  return {
    // data
    grid,
    retail,
    vat,
    // status
    loading,
    error,
    loaded,
    retailPricingMode,
    // accessors
    getGridValueAt,
    getRetailValueAt,
    setRetailPricingMode,
    getRetailEnergyPriceAt,
    getVatRateAt,
    loadAll
  }
})
