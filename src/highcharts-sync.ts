import Highcharts from '@/highcharts-theme'

// Registry of grouped Highcharts instances
const highcGroups: Record<string, Set<Highcharts.Chart>> = {}

interface SyncHandlers {
  mousemove: (e: MouseEvent) => void
  mouseleave: () => void
}

interface DisplayUpdateCallback {
  (time: string, value: string): void
}

type XYData = { x: number[]; y: Array<number | null> }

function getSeriesXY(series: Highcharts.Series): XYData | null {
  // Highcharts v12 (and Boost) stores data in a DataTable; getColumn is the most robust.
  const anySeries = series as any
  const getColumn = typeof anySeries.getColumn === 'function' ? anySeries.getColumn.bind(anySeries) : null
  const xCol = (getColumn && (getColumn('x', true) || getColumn('x'))) as number[] | undefined
  const yCol = (getColumn && (getColumn('y', true) || getColumn('y'))) as Array<number | null> | undefined

  if (Array.isArray(xCol) && xCol.length) {
    const y = Array.isArray(yCol) ? yCol : []
    return { x: xCol, y }
  }

  // Fallbacks for non-boosted series.
  const xData = (anySeries.xData as number[] | undefined) || []
  const yData = (anySeries.yData as Array<number | null> | undefined) || []
  if (Array.isArray(xData) && xData.length) return { x: xData, y: Array.isArray(yData) ? yData : [] }

  const optData = (anySeries.options?.data as any[] | undefined) || []
  if (Array.isArray(optData) && optData.length) {
    const x: number[] = []
    const y: Array<number | null> = []
    for (const row of optData) {
      if (Array.isArray(row) && row.length >= 2) {
        x.push(row[0])
        y.push(row[1])
      } else if (row && typeof row === 'object' && 'x' in row) {
        x.push((row as any).x)
        y.push((row as any).y ?? null)
      }
    }
    if (x.length) return { x, y }
  }

  return null
}

function findNearestIndex(sortedX: number[], x: number) {
  if (!sortedX.length) return -1
  let lo = 0
  let hi = sortedX.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const px = sortedX[mid]
    if (px === x) return mid
    if (px < x) lo = mid + 1
    else hi = mid - 1
  }
  if (lo <= 0) return 0
  if (lo >= sortedX.length) return sortedX.length - 1
  const a = sortedX[lo - 1]
  const b = sortedX[lo]
  return (x - a) <= (b - x) ? (lo - 1) : lo
}

function highlightXY(chart: Highcharts.Chart, seriesName: string, xVal: number, yVal: number | null | undefined) {
  const displayCallback = (chart as any).__displayUpdateCallback as DisplayUpdateCallback | undefined
  if (displayCallback) {
    const date = new Date(xVal)
    const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    let valueStr = ''
    if (yVal != null) {
      if (seriesName === 'Price') {
        valueStr = `${yVal.toFixed(3)} c/kWh`
      } else if (seriesName === 'Production') {
        valueStr = `${yVal.toFixed(2)} kWh`
      } else {
        valueStr = `${yVal.toFixed(2)} kWh`
      }
    }
    displayCallback(timeStr, valueStr)
  }

  const axis = chart.xAxis[0]
  const plotX = axis.toPixels(xVal, true)
  axis.drawCrosshair(undefined as any, { x: xVal, plotX } as any)
}

export function registerHighCChart(chart: Highcharts.Chart, group = 'highcEnergy', displayCallback?: DisplayUpdateCallback) {
  if (!highcGroups[group]) highcGroups[group] = new Set()
  highcGroups[group].add(chart)
  
  if (displayCallback) {
    (chart as any).__displayUpdateCallback = displayCallback
  }

  Highcharts.addEvent(chart.xAxis[0], 'setExtremes', function (e: Highcharts.AxisSetExtremesEventObject) {
    const trigger = (e as any).trigger
    // Skip if this event came from another chart's sync
    if (trigger === 'sync') return
    
    // Log to help diagnose zoom issues
    console.debug('[highcharts-sync] setExtremes', chart.container.id, 'trigger:', trigger, 'min:', e.min, 'max:', e.max)
    
    const isReset = (e.min == null && e.max == null)
    highcGroups[group].forEach(other => {
      if (other === chart) return
      // Guard against destroyed charts or charts without axes
      if (!other.xAxis || !other.xAxis[0] || !other.container?.ownerDocument) return
      try {
        if (isReset) {
          other.xAxis[0].setExtremes(undefined, undefined, true, false, { trigger: 'sync' })
        } else if (e.min != null && e.max != null) {
          other.xAxis[0].setExtremes(e.min, e.max, true, false, { trigger: 'sync' })
        }
      } catch (err) {
        // Silently ignore errors during sync (e.g., chart being destroyed)
        console.debug('[highcharts-sync] Sync error:', err)
      }
    })
  })

  const container = chart.container

  let rafPending = false
  let lastMoveEvent: MouseEvent | null = null

  const handleMove = () => {
    rafPending = false
    const ev = lastMoveEvent
    lastMoveEvent = null
    if (!ev) return

    const primarySeries = chart.series[0]
    if (!primarySeries) return

    const norm = chart.pointer.normalize(ev)
    const plotX = norm.chartX - chart.plotLeft
    if (!Number.isFinite(plotX)) return

    const xAxis = chart.xAxis[0]
    const xVal = xAxis.toValue(plotX, true)
    if (!Number.isFinite(xVal)) return

    const sourceXY = getSeriesXY(primarySeries)
    if (!sourceXY) return
    const idx = findNearestIndex(sourceXY.x, xVal)
    if (idx < 0) return
    const nearestX = sourceXY.x[idx]
    const nearestY = sourceXY.y[idx]

    // Highlight in source chart
    highlightXY(chart, primarySeries.name, nearestX, nearestY)

    // Propagate to peers
    highcGroups[group].forEach(other => {
      if (other === chart) return
      // Guard against destroyed charts
      if (!other.xAxis || !other.xAxis[0] || !other.container?.ownerDocument) return
      const otherSeries = other.series[0]
      if (!otherSeries) return
      const otherXY = getSeriesXY(otherSeries)
      if (!otherXY) return
      const otherIdx = findNearestIndex(otherXY.x, nearestX)
      if (otherIdx < 0) return
      try {
        highlightXY(other, otherSeries.name, otherXY.x[otherIdx], otherXY.y[otherIdx])
      } catch (err) {
        // Silently ignore errors during highlight
      }
    })
  }

  const mousemove = (ev: MouseEvent) => {
    lastMoveEvent = ev
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(handleMove)
  }
  const mouseleave = () => {
    highcGroups[group].forEach(c => {
      // Guard against destroyed charts
      if (!c.xAxis || !c.xAxis[0] || !c.container?.ownerDocument) return
      try {
        c.xAxis[0].hideCrosshair()
        const callback = (c as any).__displayUpdateCallback as DisplayUpdateCallback | undefined
        if (callback) callback('', '')
      } catch (err) {
        // Silently ignore errors
      }
    })
  }
  container.addEventListener('mousemove', mousemove)
  container.addEventListener('mouseleave', mouseleave)
  ;(chart as any).__highcSyncHandlers = { mousemove, mouseleave } as SyncHandlers
}

export function unregisterHighCChart(chart: Highcharts.Chart, group = 'highcEnergy') {
  const set = highcGroups[group]
  if (set && set.has(chart)) set.delete(chart)
  if (set && !set.size) delete highcGroups[group]
  const handlers = (chart as any).__highcSyncHandlers as SyncHandlers | undefined
  if (handlers) {
    chart.container.removeEventListener('mousemove', handlers.mousemove)
    chart.container.removeEventListener('mouseleave', handlers.mouseleave)
  }
  delete (chart as any).__highcSyncHandlers
}

export function resetHighCZoom(group = 'highcEnergy') {
  const set = highcGroups[group]; if (!set) return
  set.forEach(ch => {
    // Guard against destroyed charts
    if (!ch.xAxis || !ch.xAxis[0] || !ch.container?.ownerDocument) return
    try { 
      ch.xAxis[0].setExtremes(undefined, undefined, true, false, { trigger: 'sync' }) 
    } catch (err) {
      // Silently ignore errors
    }
  })
}
