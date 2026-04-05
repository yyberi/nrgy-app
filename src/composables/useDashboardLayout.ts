import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LayoutItem } from 'vue-grid-layout-v3'

/**
 * Composable for managing dashboard grid layout
 * Handles dynamic row height calculation and layout configuration
 */
export function useDashboardLayout() {
  const rowHeight = ref(100)
  const totalRows = 8 // 2 + 2 + 4 = 8 rows total
  const verticalMargin = 6 // margin between rows

  /**
   * Calculate row height based on available window height
   */
  function calculateRowHeight() {
    // Calculate available height: window height minus header, padding, and margins
    const availableHeight = window.innerHeight - 130 // Reserve space for header, padding, margins, etc.
    const totalMargins = (totalRows - 1) * verticalMargin
    rowHeight.value = Math.max(60, (availableHeight - totalMargins) / totalRows)
  }

  const dashboardLayout = ref<LayoutItem[]>([
    // Charts in three equal columns and two rows (1/4 of view each)
    { x: 0, y: 0, w: 4, h: 2, i: 'solar-chart', static: true },
    { x: 4, y: 0, w: 4, h: 2, i: 'import-chart', static: true },
    { x: 8, y: 0, w: 4, h: 2, i: 'chart-5', static: true },
    { x: 0, y: 2, w: 4, h: 2, i: 'price-chart', static: true },
    { x: 4, y: 2, w: 4, h: 2, i: 'export-chart', static: true },
    { x: 8, y: 2, w: 4, h: 2, i: 'chart-6', static: true },
    // Unified summary area below the charts
    { x: 0, y: 4, w: 12, h: 4, i: 'summary', static: true }
  ])

  const dashboardLayoutById = computed<Record<string, LayoutItem>>(() =>
    dashboardLayout.value.reduce((acc, item) => {
      acc[item.i] = item
      return acc
    }, {} as Record<string, LayoutItem>)
  )

  onMounted(() => {
    calculateRowHeight()
    window.addEventListener('resize', calculateRowHeight)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', calculateRowHeight)
  })

  return {
    rowHeight,
    dashboardLayout,
    dashboardLayoutById
  }
}
