<template>
  <div class="time-selection">
    <div class="timeline-wrapper" v-show="timelineReady">
        <div 
          ref="timelineTrackRef" 
          class="timeline-track"
          @mousedown="handleTrackClick"
        >
          <div class="timeline-boundaries">
            <div 
              v-for="boundary in timelineBoundaries" 
              :key="boundary.key"
              class="timeline-boundary"
              :style="{ left: boundary.position + '%' }"
            ></div>
          </div>
          <div class="timeline-markers">
            <div 
              v-for="marker in timelineMarkers" 
              :key="marker.key"
              class="timeline-marker"
              :style="{ left: marker.position + '%' }"
              :title="marker.label"
            >
              <div class="marker-label">{{ marker.shortLabel }}</div>
            </div>
          </div>
          <div 
            class="timeline-bar"
            :class="{ 'timeline-bar-day': duration === '1d', 'timeline-bar-week': duration === '1w' }"
            :style="barStyle"
            @mousedown.stop="handleBarMouseDown"
          >
            <span class="bar-label">{{ barLabel }}</span>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCombinedDataStore } from '@/stores/combined-data'
import { resetHighCZoom } from '@/highcharts-sync'

type DurationKey = '1d' | '1w' | '1m' | '1y' | 'all'

const DAY_MS = 24 * 3600 * 1000
const WEEK_MS = 7 * DAY_MS
const DAY_BAR_MIN_WIDTH_PX = 92
const WEEK_BAR_MIN_WIDTH_PX = 92
const DEFAULT_START_DATE = new Date(2023, 0, 1) // 1 January 2023 (local time)
const durationOptions: Array<{ value: DurationKey; label: string }> = [
  { value: '1d', label: 'day' },
  { value: '1w', label: 'week' },
  { value: '1m', label: 'month' },
  { value: '1y', label: 'year' },
  { value: 'all', label: 'all' }
]

const combinedStore = useCombinedDataStore()
const {
  rangeStartDate,
  rangeEndDateInclusive,
  availableStartMs,
  availableEndMsExclusive,
  loading,
  indexLoaded
} = storeToRefs(combinedStore)

const yearOptions = computed<number[]>(() => {
  if (availableStartMs.value == null || availableEndMsExclusive.value == null) return []
  const startYear = new Date(availableStartMs.value).getFullYear()
  const endYear = new Date(availableEndMsExclusive.value - 1).getFullYear()
  const years: number[] = []
  for (let year = startYear; year <= endYear; year++) {
    years.push(year)
  }
  return years
})

const timelineTrackRef = ref<HTMLElement | null>(null)
const timelineTrackWidth = ref(0)
let trackResizeObserver: ResizeObserver | null = null
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartPosition = ref(0)
const dragCurrentPosition = ref(0)
const dragCurrentEndPosition = ref(0) // Store the intended end position

const duration = ref<DurationKey>('all')
const selectedYear = ref(0)
const defaultRangeApplied = ref(false)

watch(
  yearOptions,
  (years) => {
    if (!years.length) return
    if (years.includes(selectedYear.value)) return
    selectedYear.value = years[years.length - 1]
  },
  { immediate: true }
)

const currentRange = computed(() => {
  const startDate = rangeStartDate.value
  const endDate = rangeEndDateInclusive.value
  if (!startDate || !endDate) return null
  return {
    startMs: startOfLocalDay(startDate),
    endExclusiveMs: nextLocalDayStart(endDate)
  }
})

const rangeReady = computed(
  () =>
    availableStartMs.value != null &&
    availableEndMsExclusive.value != null &&
    !loading.value
)

const timelineReady = computed(
  () =>
    availableStartMs.value != null &&
    availableEndMsExclusive.value != null
)

const timelineStartMs = computed(() => {
  if (!availableStartMs.value) return 0
  if (duration.value === 'all') return availableStartMs.value
  const yearStart = new Date(selectedYear.value, 0, 1).getTime()
  // Timeline starts at the later of: available data start or selected year start
  return Math.max(availableStartMs.value, yearStart)
})

const timelineEndMs = computed(() => {
  if (!availableEndMsExclusive.value) return 0
  if (duration.value === 'all') return availableEndMsExclusive.value
  const yearEndExclusive = new Date(selectedYear.value + 1, 0, 1).getTime()
  // Timeline ends at the earlier of: available data end or selected year end
  return Math.min(availableEndMsExclusive.value, yearEndExclusive)
})

const timelineDurationMs = computed(() => timelineEndMs.value - timelineStartMs.value)

const selectedRangeLabel = computed(() => {
  const current = currentRange.value
  if (!current) return '—'
  const startDate = new Date(current.startMs)
  const endDate = new Date(current.endExclusiveMs - DAY_MS)
  return `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`
})

const barLabel = computed(() => {
  const current = currentRange.value
  if (!current) return ''
  if (duration.value === 'all') return 'all'
  const labelStartMs = isDragging.value ? dragCurrentPosition.value : current.startMs

  if (duration.value === '1d') {
    return formatDateDisplay(new Date(labelStartMs))
  }
  
  // Find the marker that contains the current selection start
  const markers = timelineMarkers.value
  for (const marker of markers) {
    if (labelStartMs >= marker.startMs && labelStartMs < marker.endMs) {
      return marker.shortLabel
    }
  }
  
  // Fallback to first marker if no match
  return markers.length > 0 ? markers[0].shortLabel : ''
})

const barStyle = computed(() => {
  const current = currentRange.value
  if (!current || timelineDurationMs.value === 0) return { left: '0%', width: '0%' }
  
  let startMs: number
  let endMs: number
  
  if (isDragging.value) {
    // During drag, use stored positions
    startMs = dragCurrentPosition.value
    endMs = dragCurrentEndPosition.value
  } else {
    // Use current range from store
    startMs = current.startMs
    endMs = current.endExclusiveMs
  }
  
  const barStart = startMs - timelineStartMs.value
  const barDuration = endMs - startMs
  
  const leftPercent = (barStart / timelineDurationMs.value) * 100
  const widthPercent = (barDuration / timelineDurationMs.value) * 100

  if ((duration.value === '1d' || duration.value === '1w') && timelineTrackWidth.value > 0) {
    const rawWidthPx = (widthPercent / 100) * timelineTrackWidth.value
    const minWidthPx = duration.value === '1d' ? DAY_BAR_MIN_WIDTH_PX : WEEK_BAR_MIN_WIDTH_PX
    const widthPx = Math.min(timelineTrackWidth.value, Math.max(minWidthPx, rawWidthPx))
    const maxTravelPx = Math.max(0, timelineTrackWidth.value - widthPx)
    const bounds = duration.value === '1d' ? getDayStartBounds() : getWeekStartBounds()
    const periodStartRangeMs = Math.max(0, bounds.maxStart - bounds.minStart)
    const normalized = periodStartRangeMs === 0
      ? 0
      : Math.max(0, Math.min(1, (startMs - bounds.minStart) / periodStartRangeMs))
    const leftPx = normalized * maxTravelPx
    return {
      left: `${leftPx}px`,
      width: `${widthPx}px`
    }
  }
  
  return {
    left: `${Math.max(0, Math.min(100, leftPercent))}%`,
    width: `${Math.max(0, Math.min(100, widthPercent))}%`
  }
})

// Timeline markers based on duration
const timelineMarkers = computed(() => {
  if (timelineDurationMs.value === 0) return []
  
  const markers: Array<{ key: string; position: number; label: string; shortLabel: string; startMs: number; endMs: number }> = []
  const startDate = new Date(timelineStartMs.value)
  const endDate = new Date(timelineEndMs.value)
  
  if (duration.value === '1y' || duration.value === 'all') {
    // Year markers - show in center of each year
    let year = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    
    while (year <= endYear) {
      const yearStart = Math.max(new Date(year, 0, 1).getTime(), timelineStartMs.value)
      const yearEnd = Math.min(new Date(year + 1, 0, 1).getTime(), timelineEndMs.value)
      
      if (yearStart < yearEnd) {
        // Calculate center position for label
        const centerMs = (yearStart + yearEnd) / 2
        const position = ((centerMs - timelineStartMs.value) / timelineDurationMs.value) * 100
        
        markers.push({
          key: `${year}`,
          position,
          label: `${year}`,
          shortLabel: `${year}`,
          startMs: yearStart,
          endMs: yearEnd
        })
      }
      year++
    }
  } else if (duration.value === '1m') {
    // Month markers - show in center of each month
    let year = startDate.getFullYear()
    let month = startDate.getMonth()
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth()
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthStart = Math.max(new Date(year, month, 1).getTime(), timelineStartMs.value)
      const monthEnd = Math.min(new Date(year, month + 1, 1).getTime(), timelineEndMs.value)
      
      if (monthStart < monthEnd) {
        // Calculate center position for label
        const centerMs = (monthStart + monthEnd) / 2
        const position = ((centerMs - timelineStartMs.value) / timelineDurationMs.value) * 100
        const monthName = new Date(year, month, 1).toLocaleDateString('en', { month: 'short' })
        
        markers.push({
          key: `${year}-${month}`,
          position,
          label: `${monthName} ${year}`,
          shortLabel: monthName,
          startMs: monthStart,
          endMs: monthEnd
        })
      }
      
      month++
      if (month > 11) {
        month = 0
        year++
      }
    }
  } else if (duration.value === '1w') {
    // Week markers - show in center of each week
    let currentDate = new Date(startOfLocalWeek(new Date(timelineStartMs.value)))
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    
    while (currentDate < endDate) {
      const weekStart = currentDate.getTime()
      const nextWeek = new Date(currentDate.getTime())
      nextWeek.setDate(nextWeek.getDate() + 7)
      const weekEnd = nextWeek.getTime()

      const visibleWeekStart = Math.max(weekStart, timelineStartMs.value)
      const visibleWeekEnd = Math.min(weekEnd, timelineEndMs.value)
      
      if (visibleWeekStart < visibleWeekEnd) {
        // Calculate center position for label based on visible segment.
        const centerMs = (visibleWeekStart + visibleWeekEnd) / 2
        const position = ((centerMs - timelineStartMs.value) / timelineDurationMs.value) * 100
        const weekNum = getWeekNumber(currentDate)
        
        markers.push({
          key: `${currentDate.getFullYear()}-W${weekNum}`,
          position,
          label: `Week ${weekNum}, ${currentDate.getFullYear()}`,
          shortLabel: `W${weekNum}`,
          startMs: weekStart,
          endMs: weekEnd
        })
      }
      
      currentDate.setDate(currentDate.getDate() + 7)
    }
  } else if (duration.value === '1d') {
    // Day mode uses continuous dragging, but labels are shown by month for readability.
    let year = startDate.getFullYear()
    let month = startDate.getMonth()
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth()

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthStart = Math.max(new Date(year, month, 1).getTime(), timelineStartMs.value)
      const monthEnd = Math.min(new Date(year, month + 1, 1).getTime(), timelineEndMs.value)

      if (monthStart < monthEnd) {
        const centerMs = (monthStart + monthEnd) / 2
        const position = ((centerMs - timelineStartMs.value) / timelineDurationMs.value) * 100
        const monthName = new Date(year, month, 1).toLocaleDateString('en', { month: 'short' })

        markers.push({
          key: `${year}-${month}`,
          position,
          label: `${monthName} ${year}`,
          shortLabel: monthName,
          startMs: monthStart,
          endMs: monthEnd
        })
      }

      month++
      if (month > 11) {
        month = 0
        year++
      }
    }
  }
  
  return markers
})

// Timeline boundary lines (shown between periods)
const timelineBoundaries = computed(() => {
  if (duration.value === '1d') return []

  const boundaries: Array<{ key: string; position: number }> = []
  const markers = timelineMarkers.value
  
  // Create boundary lines between markers
  for (let i = 1; i < markers.length; i++) {
    const prevMarker = markers[i - 1]
    const boundaryMs = prevMarker.endMs
    
    // Only show if boundary is within timeline
    if (boundaryMs > timelineStartMs.value && boundaryMs < timelineEndMs.value) {
      const position = ((boundaryMs - timelineStartMs.value) / timelineDurationMs.value) * 100
      boundaries.push({
        key: `boundary-${i}`,
        position
      })
    }
  }
  
  return boundaries
})

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7)
}

// Helper functions
function formatDateDisplay(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function nextLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
}

function startOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

function startOfLocalYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1).getTime()
}

function alignStartToDuration(startMs: number, key: DurationKey) {
  switch (key) {
    case '1d':
      return startOfLocalDay(new Date(startMs))
    case '1w':
      return startOfLocalWeek(new Date(startMs))
    case '1m':
      return startOfLocalMonth(new Date(startMs))
    case '1y':
      return startOfLocalYear(new Date(startMs))
    case 'all':
      return startMs
  }
}

function getDayStartBounds() {
  const min = timelineStartMs.value
  const maxExclusive = timelineEndMs.value
  const minDayStartBase = startOfLocalDay(new Date(min))
  const minDayStart = min > minDayStartBase ? nextLocalDayStart(new Date(min)) : minDayStartBase
  const maxDayStart = startOfLocalDay(new Date(maxExclusive - DAY_MS))
  return { minStart: minDayStart, maxStart: maxDayStart }
}

function startOfLocalWeek(date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = dayStart.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  dayStart.setDate(dayStart.getDate() - daysSinceMonday)
  return dayStart.getTime()
}

function getWeekStartBounds() {
  const min = timelineStartMs.value
  const maxExclusive = timelineEndMs.value
  // Allow selecting boundary weeks that overlap the visible timeline year
  // (e.g. week 1 starts in previous year, or last week ends in next year).
  const minWeekStart = startOfLocalWeek(new Date(min))
  const maxWeekStart = startOfLocalWeek(new Date(maxExclusive - 1))
  return { minStart: minWeekStart, maxStart: maxWeekStart }
}

function addDurationExclusive(startMs: number, key: DurationKey) {
  switch (key) {
    case '1d':
      return nextLocalDayStart(new Date(startOfLocalDay(new Date(startMs))))
    case '1w': {
      const baseStart = startOfLocalDay(new Date(startMs))
      const baseDate = new Date(baseStart)
      baseDate.setDate(baseDate.getDate() + 7)
      return startOfLocalDay(baseDate)
    }
    case '1m': {
      const baseStart = startOfLocalDay(new Date(startMs))
      const baseDate = new Date(baseStart)
      baseDate.setMonth(baseDate.getMonth() + 1)
      return startOfLocalDay(baseDate)
    }
    case '1y': {
      const baseStart = startOfLocalDay(new Date(startMs))
      const baseDate = new Date(baseStart)
      baseDate.setFullYear(baseDate.getFullYear() + 1)
      return startOfLocalDay(baseDate)
    }
    case 'all':
      return timelineEndMs.value
  }
}

function clampRangeToBounds(startMs: number, endExclusiveMs: number) {
  let start = startMs
  let end = endExclusiveMs
  // Clamp to the selected year's timeline bounds
  const min = timelineStartMs.value
  const maxExclusive = timelineEndMs.value

  if (duration.value === 'all') {
    return { start: min, end: maxExclusive }
  }

  if (duration.value === '1d') {
    // Ensure daily selection is always one full local day.
    const { minStart, maxStart } = getDayStartBounds()

    let clampedStart = startOfLocalDay(new Date(start))
    if (clampedStart < minStart) clampedStart = minStart
    if (clampedStart > maxStart) clampedStart = maxStart

    const clampedEnd = clampedStart + DAY_MS
    return { start: clampedStart, end: clampedEnd }
  }

  if (duration.value === '1w') {
    // Ensure weekly selection is always one full local week (Mon-Sun).
    const { minStart, maxStart } = getWeekStartBounds()
    if (minStart <= maxStart) {
      let clampedStart = startOfLocalWeek(new Date(start))
      if (clampedStart < minStart) clampedStart = minStart
      if (clampedStart > maxStart) clampedStart = maxStart
      return { start: clampedStart, end: clampedStart + WEEK_MS }
    }
  }

  if (start < min) start = min
  if (end > maxExclusive) end = maxExclusive
  if (end <= start) {
    end = start + DAY_MS
    if (end > maxExclusive) {
      end = maxExclusive
      start = end - DAY_MS
      if (start < min) start = min
    }
  }
  return { start, end }
}

function snapToNearestPeriod(targetMs: number): number {
  if (duration.value === '1d') return startOfLocalDay(new Date(targetMs))
  if (duration.value === '1w') return startOfLocalWeek(new Date(targetMs))

  const markers = timelineMarkers.value
  if (markers.length === 0) return targetMs
  
  // Find which period box contains the target
  for (const marker of markers) {
    if (targetMs >= marker.startMs && targetMs < marker.endMs) {
      return marker.startMs
    }
  }
  
  // If not in any box, find the closest period
  let closest = markers[0].startMs
  let minDiff = Math.abs(targetMs - closest)
  
  for (const marker of markers) {
    const diffToStart = Math.abs(targetMs - marker.startMs)
    if (diffToStart < minDiff) {
      minDiff = diffToStart
      closest = marker.startMs
    }
  }
  
  return closest
}

function applyRange(startMs: number, endExclusiveMs: number, immediate = false) {
  const startIso = new Date(startMs).toISOString()
  const endIso = new Date(endExclusiveMs).toISOString()
  
  if (immediate) {
    combinedStore.setRange(startIso, endIso)
  } else {
    // Double requestAnimationFrame ensures DOM is fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        combinedStore.setRange(startIso, endIso)
        // Mark dragging as complete after store update
        // This allows the bar to show the correct position throughout
        requestAnimationFrame(() => {
          isDragging.value = false
        })
      })
    })
  }
}

// Dragging functions
function handleBarMouseDown(event: MouseEvent) {
  event.preventDefault()
  isDragging.value = true
  dragStartX.value = event.clientX
  
  const current = currentRange.value
  if (current) {
    dragStartPosition.value = current.startMs
    dragCurrentPosition.value = current.startMs
    dragCurrentEndPosition.value = current.endExclusiveMs
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value || !timelineTrackRef.value) return
  
  const current = currentRange.value
  if (!current) return
  
  const rect = timelineTrackRef.value.getBoundingClientRect()
  let newStartMs: number

  if (event.clientX <= rect.left) {
    newStartMs = timelineStartMs.value
  } else if (event.clientX >= rect.right) {
    newStartMs = timelineEndMs.value
  } else {
    const deltaX = event.clientX - dragStartX.value
    const deltaPercent = deltaX / rect.width
    const deltaMs = deltaPercent * timelineDurationMs.value
    newStartMs = dragStartPosition.value + deltaMs
  }
  
  // Snap to nearest period
  newStartMs = snapToNearestPeriod(newStartMs)
  
  // Calculate intended end based on calendar period
  const intendedEndMs = addDurationExclusive(newStartMs, duration.value)
  if (!intendedEndMs) return
  
  // Clamp to available data
  const clamped = clampRangeToBounds(newStartMs, intendedEndMs)
  dragCurrentPosition.value = clamped.start
  dragCurrentEndPosition.value = clamped.end
}

function handleMouseUp() {
  if (isDragging.value) {
    // Keep isDragging true until store is updated
    // This prevents the bar from jumping to the old position
    applyRange(dragCurrentPosition.value, dragCurrentEndPosition.value, false)
  } else {
    isDragging.value = false
  }
  
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function handleTrackClick(event: MouseEvent) {
  if (!timelineTrackRef.value || isDragging.value) return
  
  const current = currentRange.value
  if (!current) return
  
  const rect = timelineTrackRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickPercent = clickX / rect.width
  let clickMs = timelineStartMs.value + (clickPercent * timelineDurationMs.value)
  
  // Snap to nearest period
  let newStartMs = snapToNearestPeriod(clickMs)
  
  // Recalculate end based on duration (handles partial periods)
  const newEndMs = addDurationExclusive(newStartMs, duration.value)
  if (!newEndMs) return
  
  const clamped = clampRangeToBounds(newStartMs, newEndMs)
  
  // Update drag positions to show immediate feedback
  isDragging.value = true
  dragCurrentPosition.value = clamped.start
  dragCurrentEndPosition.value = clamped.end
  
  // Apply range (will clear isDragging after store updates)
  applyRange(clamped.start, clamped.end, false)
}

function handleDurationChange(newDuration: DurationKey) {
  if (!rangeReady.value) return
  if (newDuration === duration.value) return
  
  const current = currentRange.value
  if (!current) return
  
  const oldDuration = duration.value

  // Pick a target year before changing duration so switching from "all"
  // always defaults to the latest available data year.
  if (newDuration !== 'all') {
    if (oldDuration === 'all') {
      const latestYear = yearOptions.value[yearOptions.value.length - 1]
      if (latestYear != null) selectedYear.value = latestYear
    } else {
      selectedYear.value = new Date(current.startMs).getFullYear()
    }
  }

  duration.value = newDuration

  if (newDuration === 'all') {
    const { start, end } = clampRangeToBounds(timelineStartMs.value, timelineEndMs.value)
    applyRange(start, end, false)
    return
  }

  let newStartMs: number

  if (oldDuration === 'all') {
    // "all" -> period starts from first day of latest data year.
    newStartMs = timelineStartMs.value
  } else {
    // Keep user's context, but align to period boundaries
    // (e.g. day 2023-04-06 -> month 2023-04-01).
    newStartMs = current.startMs
  }

  newStartMs = alignStartToDuration(newStartMs, newDuration)
  
  const newEndMs = addDurationExclusive(newStartMs, newDuration)
  if (!newEndMs) return
  
  const clamped = clampRangeToBounds(newStartMs, newEndMs)
  applyRange(clamped.start, clamped.end, false)
}

function handleYearChange(newYear: number) {
  if (!rangeReady.value) return
  if (newYear === selectedYear.value) return
  if (!yearOptions.value.includes(newYear)) return

  const current = currentRange.value
  if (!current) return
  
  // Update selected year (this will affect timelineStartMs and timelineEndMs computed properties)
  selectedYear.value = newYear
  
  let newStartMs: number
  
  // Special case: if duration is '1y', select the whole year (or timeline start if partial year)
  if (duration.value === '1y') {
    newStartMs = timelineStartMs.value
  } else {
    // Try to preserve the same month/day in new year
    const currentDate = new Date(current.startMs)
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    
    // Set to same month/day in new year
    newStartMs = new Date(newYear, month, day).getTime()
    
    // If this date doesn't exist in the new year (e.g., Feb 29), adjust
    const testDate = new Date(newStartMs)
    if (testDate.getMonth() !== month) {
      // Fell into next month, go back to last day of intended month
      newStartMs = new Date(newYear, month + 1, 0).getTime()
    }
    
    newStartMs = startOfLocalDay(new Date(newStartMs))
  }
  
  // Calculate end based on current duration
  let newEndMs = addDurationExclusive(newStartMs, duration.value)
  if (!newEndMs) {
    // Fallback to timeline start if calculation fails
    newStartMs = timelineStartMs.value
    newEndMs = addDurationExclusive(newStartMs, duration.value)
    if (!newEndMs) return
  }
  
  // Check if the intended period is within the new year's timeline
  const clamped = clampRangeToBounds(newStartMs, newEndMs)
  
  // If clamped start is different, it means the month doesn't exist in new year data
  // In this case, use the first available period in the timeline
  if (clamped.start !== newStartMs) {
    newStartMs = timelineStartMs.value
    newEndMs = addDurationExclusive(newStartMs, duration.value)
    if (!newEndMs) return
    const reClamped = clampRangeToBounds(newStartMs, newEndMs)
    applyRange(reClamped.start, reClamped.end, false)
  } else {
    applyRange(clamped.start, clamped.end, false)
  }
}

function resetAllHighCharts() { 
  resetHighCZoom('highcEnergy') 
}

const handleKeydown = (e: KeyboardEvent) => { 
  if (e.key === 'Escape') resetAllHighCharts() 
}

const updateTrackWidth = () => {
  timelineTrackWidth.value = timelineTrackRef.value?.clientWidth ?? 0
}

watch(
  timelineTrackRef,
  (el, prevEl) => {
    if (prevEl && trackResizeObserver) trackResizeObserver.unobserve(prevEl)
    if (el && trackResizeObserver) trackResizeObserver.observe(el)
    updateTrackWidth()
  },
  { flush: 'post' }
)

// Initialize default range
watch(
  indexLoaded,
  (loaded) => {
    if (defaultRangeApplied.value) return
    if (!loaded) return
    if (availableStartMs.value == null || availableEndMsExclusive.value == null) return

    const defaultStartMs = startOfLocalDay(DEFAULT_START_DATE)
    const defaultEndMs = addDurationExclusive(defaultStartMs, duration.value)
    if (defaultEndMs == null) return
    const { start, end } = clampRangeToBounds(defaultStartMs, defaultEndMs)
    applyRange(start, end, true) // Immediate on initial load
    defaultRangeApplied.value = true
  },
  { immediate: true }
)

onMounted(() => {
  updateTrackWidth()
  window.addEventListener('resize', updateTrackWidth)

  trackResizeObserver = new ResizeObserver(() => updateTrackWidth())
  if (timelineTrackRef.value) trackResizeObserver.observe(timelineTrackRef.value)

  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateTrackWidth)
  if (trackResizeObserver) {
    trackResizeObserver.disconnect()
    trackResizeObserver = null
  }
  window.removeEventListener('keydown', handleKeydown)
  if (isDragging.value) {
    handleMouseUp()
  }
})

// Expose properties and methods for external use (e.g., in Main.vue header slot)
defineExpose({
  duration,
  selectedYear,
  durationOptions,
  yearOptions,
  rangeReady,
  timelineReady,
  selectedRangeLabel,
  handleDurationChange,
  handleYearChange,
  resetAllHighCharts
})
</script>

<style scoped>
.time-selection {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.timeline-track {
  position: relative;
  height: 32px;
  background: linear-gradient(to bottom, #2a2a2a 0%, #1f1f1f 100%);
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.timeline-boundaries {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.timeline-boundary {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1px;
  background: #555;
  transform: translateX(-50%);
}

.timeline-markers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.timeline-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.marker-label {
  font-size: 0.65rem;
  color: #aaa;
  font-weight: 500;
  white-space: nowrap;
  text-shadow: 0 0 3px #000;
}

.timeline-bar {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(135deg, #4a9eff 0%, #357abd 100%);
  border-left: 2px solid #6bb3ff;
  border-right: 2px solid #6bb3ff;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
  transition: background 0.15s;
  z-index: 10;
}

.timeline-bar-day {
  min-width: 92px;
  border-left-width: 3px;
  border-right-width: 3px;
}

.timeline-bar-week {
  min-width: 92px;
}

.timeline-bar:hover {
  background: linear-gradient(135deg, #5aadff 0%, #458aca 100%);
  box-shadow: 0 2px 12px rgba(74, 158, 255, 0.5);
}

.timeline-bar:active {
  cursor: grabbing;
}

.bar-label {
  font-size: 0.7rem;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}
</style>
