/**
 * Composable for data formatting utilities
 * Provides consistent formatting for energy, currency, and date values
 */
export function useDataFormatting() {
  /**
   * Format energy value in kWh
   */
  const formatEnergy = (value: number) => `${value.toFixed(2)} kWh`

  /**
   * Format currency value from cents to EUR
   */
  const formatCurrency = (cents: number) => `${(cents / 100).toFixed(2)} EUR`

  /**
   * Format date for input (YYYY-MM-DD)
   */
  function formatDateInput(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Build subtitle string for charts/summaries
   */
  const buildSubtitle = (unit: string, rangeLabel: string, points: number) =>
    `Unit: ${unit} • Range: ${rangeLabel} • Points: ${points}`

  return {
    formatEnergy,
    formatCurrency,
    formatDateInput,
    buildSubtitle
  }
}
