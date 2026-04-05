export type TariffComponentType = 'per_kwh' | 'percent' | 'per_month'
export type TariffUnit = 'cents_per_kwh' | 'percent' | 'eur_per_month'

export interface TariffScheduleEntry {
  from: string
  value: number
}

export interface TariffComponent {
  id: string
  type: TariffComponentType
  unit: TariffUnit
  schedule: TariffScheduleEntry[]
}

export interface TariffConfig {
  id: string
  label: string
  currency: string
  components: TariffComponent[]
}
