import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTariffDataStore } from '@/stores/tariff-data'
import type { CombinedPoint } from '@/stores/combined-data'

export interface CostBreakdown {
  energyCents: number
  marginCents: number
  transferCents: number
  taxCents: number
  vatCents: number
  totalCents: number
}

export interface RevenueBreakdown {
  revenueCents: number
}

export interface SavedConsumptionBreakdown {
  spotEnergyCents: number
  marginCents: number
  transferCents: number
  taxCents: number
  vatCents: number
  totalCents: number
}

/**
 * Composable for tariff calculations
 * Handles import cost, export revenue, and saved consumption value calculations
 */
export function useTariffCalculations(
  points: Ref<CombinedPoint[]>,
  spotPriceByHour: Ref<Map<number, number | null>>
) {
  const tariffStore = useTariffDataStore()
  const { loaded: tariffLoaded, retailPricingMode } = storeToRefs(tariffStore)

  const hourMs = 60 * 60 * 1000
  const importCostCache = new Map<string, CostBreakdown | null>()
  const exportRevenueCache = new Map<string, RevenueBreakdown | null>()
  const savedConsumptionCache = new Map<string, SavedConsumptionBreakdown | null>()

  function buildPointsSignature() {
    const rows = points.value
    if (!rows.length) return 'empty'
    const first = rows[0]?.time ?? ''
    const last = rows[rows.length - 1]?.time ?? ''
    return `${rows.length}|${first}|${last}`
  }

  /**
   * Calculate import cost breakdown from meter points
   */
  const importCostBreakdown = computed<CostBreakdown | null>(() => {
    if (!points.value.length || !tariffLoaded.value) return null
    const cacheKey = `import|${buildPointsSignature()}|${retailPricingMode.value}`
    if (importCostCache.has(cacheKey)) {
      return importCostCache.get(cacheKey) ?? null
    }
    
    const spotPriceMap = spotPriceByHour.value
    let energyCents = 0
    let marginCents = 0
    let transferCents = 0
    let taxCents = 0
    let vatCents = 0
    let missing = false

    for (const point of points.value) {
      const kwh = point.in_net ?? point.in
      if (!Number.isFinite(kwh)) continue
      const timestampMs = Date.parse(point.time)
      if (!Number.isFinite(timestampMs)) {
        missing = true
        continue
      }
      const hourKey = Math.floor(timestampMs / hourMs) * hourMs
      const spotPrice = spotPriceMap.get(hourKey) ?? null
      const energyPrice = tariffStore.getRetailEnergyPriceAt(timestampMs, spotPrice)
      const salesMargin = tariffStore.getRetailValueAt('sales_margin', timestampMs)
      const transferFee = tariffStore.getGridValueAt('transfer_fee', timestampMs)
      const energyTax = tariffStore.getGridValueAt('energy_tax', timestampMs)
      const vatRate = tariffStore.getVatRateAt(timestampMs)

      if (
        energyPrice == null ||
        salesMargin == null ||
        transferFee == null ||
        energyTax == null ||
        vatRate == null
      ) {
        missing = true
        continue
      }

      energyCents += energyPrice * kwh
      marginCents += salesMargin * kwh
      transferCents += transferFee * kwh
      taxCents += energyTax * kwh
      const baseCents = (energyPrice + salesMargin + transferFee + energyTax) * kwh
      vatCents += baseCents * (vatRate / 100)
    }

    if (missing) {
      importCostCache.set(cacheKey, null)
      return null
    }
    const totalCents = energyCents + marginCents + transferCents + taxCents + vatCents
    const result = { energyCents, marginCents, transferCents, taxCents, vatCents, totalCents }
    importCostCache.set(cacheKey, result)
    return result
  })

  /**
   * Calculate export revenue breakdown from meter points
   */
  const exportRevenueBreakdown = computed<RevenueBreakdown | null>(() => {
    if (!points.value.length || !tariffLoaded.value) return null
    const cacheKey = `export|${buildPointsSignature()}`
    if (exportRevenueCache.has(cacheKey)) {
      return exportRevenueCache.get(cacheKey) ?? null
    }
    
    const spotPriceMap = spotPriceByHour.value
    let revenueCents = 0
    let missing = false

    for (const point of points.value) {
      const kwh = point.out_net ?? point.out
      if (!Number.isFinite(kwh)) continue
      const timestampMs = Date.parse(point.time)
      if (!Number.isFinite(timestampMs)) {
        missing = true
        continue
      }
      const hourKey = Math.floor(timestampMs / hourMs) * hourMs
      const spotPrice = spotPriceMap.get(hourKey) ?? null
      const buybackMargin = tariffStore.getRetailValueAt('buyback_margin', timestampMs)

      if (spotPrice == null || buybackMargin == null) {
        missing = true
        continue
      }

      const netPrice = spotPrice - buybackMargin
      revenueCents += netPrice * kwh
    }

    if (missing) {
      exportRevenueCache.set(cacheKey, null)
      return null
    }
    const result = { revenueCents }
    exportRevenueCache.set(cacheKey, result)
    return result
  })

  /**
   * Calculate saved consumption value breakdown from meter points
   */
  const savedConsumptionValueBreakdown = computed<SavedConsumptionBreakdown | null>(() => {
    if (!points.value.length || !tariffLoaded.value) return null
    const cacheKey = `saved|${buildPointsSignature()}`
    if (savedConsumptionCache.has(cacheKey)) {
      return savedConsumptionCache.get(cacheKey) ?? null
    }
    
    const spotPriceMap = spotPriceByHour.value
    let spotEnergyCents = 0
    let marginCents = 0
    let transferCents = 0
    let taxCents = 0
    let vatCents = 0
    let missing = false

    for (const point of points.value) {
      const kwh = point.saved_cons
      if (!Number.isFinite(kwh)) continue
      const timestampMs = Date.parse(point.time)
      if (!Number.isFinite(timestampMs)) {
        missing = true
        continue
      }

      const hourKey = Math.floor(timestampMs / hourMs) * hourMs
      const spotPrice = spotPriceMap.get(hourKey) ?? null
      const salesMargin = tariffStore.getRetailValueAt('sales_margin', timestampMs)
      const transferFee = tariffStore.getGridValueAt('transfer_fee', timestampMs)
      const energyTax = tariffStore.getGridValueAt('energy_tax', timestampMs)
      const vatRate = tariffStore.getVatRateAt(timestampMs)

      if (
        spotPrice == null ||
        salesMargin == null ||
        transferFee == null ||
        energyTax == null ||
        vatRate == null
      ) {
        missing = true
        continue
      }

      spotEnergyCents += spotPrice * kwh
      marginCents += salesMargin * kwh
      transferCents += transferFee * kwh
      taxCents += energyTax * kwh
      const baseCents = (spotPrice + salesMargin + transferFee + energyTax) * kwh
      vatCents += baseCents * (vatRate / 100)
    }

    if (missing) {
      savedConsumptionCache.set(cacheKey, null)
      return null
    }
    const totalCents = spotEnergyCents + marginCents + transferCents + taxCents + vatCents
    const result = { spotEnergyCents, marginCents, transferCents, taxCents, vatCents, totalCents }
    savedConsumptionCache.set(cacheKey, result)
    return result
  })

  return {
    importCostBreakdown,
    exportRevenueBreakdown,
    savedConsumptionValueBreakdown,
    retailPricingMode
  }
}
