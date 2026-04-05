import { ref, watch } from 'vue'
import { onINP } from 'web-vitals/attribution'

const STORAGE_KEY = 'nrgy.inpDebugEnabled'

function readStoredEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

export const inpDebugEnabled = ref<boolean>(readStoredEnabled())

export interface InteractionTimingRecord {
  id: number
  inpMs: number
  paintMs: number
  timestamp: string
  selector: string | null
}

export const interactionTimingRecords = ref<InteractionTimingRecord[]>([])

let initialized = false
let eventObserver: PerformanceObserver | null = null
let inpMetricObserverInitialized = false
const activeVisualCompletion = new Set<number>()
const pendingInteractionRecords = new Map<number, {
  id: number
  inpMs: number
  timestamp: string
  selector: string | null
}>()
let nextInteractionRecordId = 1

const VISUAL_COMPLETE_SETTLE_MS = 120
const VISUAL_COMPLETE_MAX_WAIT_MS = 5000
const MAX_INTERACTION_RECORDS = 200

function toIsoFromEntryTime(startTimeMs: number): string {
  const absoluteMs = performance.timeOrigin + startTimeMs
  return new Date(absoluteMs).toISOString()
}

function buildElementSelector(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null

  const tag = target.tagName.toLowerCase()
  const id = target.id ? `#${target.id}` : ''
  const classNames = Array.from(target.classList)
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join('')

  return `${tag}${id}${classNames}`
}

function trackVisualCompletion(
  startTimeMs: number,
  interactionId: number,
  selector: string | null
) {
  if (typeof window === 'undefined') return
  if (interactionId <= 0) return
  if (activeVisualCompletion.has(interactionId)) return

  activeVisualCompletion.add(interactionId)

  const trackingStartedAt = performance.now()
  let lastMutationAt = trackingStartedAt

  const mutationObserver = new MutationObserver(() => {
    lastMutationAt = performance.now()
  })

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  })

  const finish = (reason: 'settled' | 'timeout') => {
    mutationObserver.disconnect()
    activeVisualCompletion.delete(interactionId)

    const completedAt = performance.now()
    const paintMs = completedAt - startTimeMs

    const pending = pendingInteractionRecords.get(interactionId)
    if (pending) {
      pendingInteractionRecords.delete(interactionId)
      interactionTimingRecords.value = [
        {
          id: pending.id,
          inpMs: pending.inpMs,
          paintMs,
          timestamp: pending.timestamp,
          selector: pending.selector
        },
        ...interactionTimingRecords.value
      ].slice(0, MAX_INTERACTION_RECORDS)
    }

    console.log('[web-vitals][visual-complete]', {
      timestamp: new Date(performance.timeOrigin + completedAt).toISOString(),
      selector,
      interactionId,
      value: paintMs,
      reason
    })
  }

  const checkSettled = () => {
    if (!inpDebugEnabled.value) {
      mutationObserver.disconnect()
      activeVisualCompletion.delete(interactionId)
      return
    }

    const now = performance.now()
    if (now - startTimeMs >= VISUAL_COMPLETE_MAX_WAIT_MS) {
      finish('timeout')
      return
    }

    if (now - lastMutationAt >= VISUAL_COMPLETE_SETTLE_MS) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => finish('settled'))
      })
      return
    }

    requestAnimationFrame(checkSettled)
  }

  requestAnimationFrame(checkSettled)
}

function startDebugLogging() {
  if (typeof window === 'undefined') return

  console.log('[web-vitals][INP] debug tracking enabled')

  if (!inpMetricObserverInitialized) {
    inpMetricObserverInitialized = true
    onINP(
      (metric) => {
        if (!inpDebugEnabled.value) return

        const hasClickEntry = metric.entries.some((entry) => {
          const eventEntry = entry as PerformanceEventTiming
          return eventEntry.name === 'click'
        })
        if (!hasClickEntry) return

        console.log('[web-vitals][INP]', {
          timestamp: toIsoFromEntryTime(metric.entries[0]?.startTime ?? performance.now()),
          selector: buildElementSelector(metric.entries[0]?.target ?? null),
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          entries: metric.entries.length,
          id: metric.id
        })
      },
      { reportAllChanges: true, durationThreshold: 0 }
    )
  }

  if (typeof PerformanceObserver === 'undefined') return

  try {
    eventObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as PerformanceEventTiming
        if (eventEntry.name !== 'click') continue

        console.log('[web-vitals][event]', {
          timestamp: toIsoFromEntryTime(eventEntry.startTime),
          selector: buildElementSelector(eventEntry.target),
          name: eventEntry.name,
          duration: eventEntry.duration,
          startTime: eventEntry.startTime,
          interactionId: eventEntry.interactionId,
          processingStart: eventEntry.processingStart,
          processingEnd: eventEntry.processingEnd,
          inputDelay: eventEntry.processingStart - eventEntry.startTime,
          processingDuration: eventEntry.processingEnd - eventEntry.processingStart,
          presentationDelay: eventEntry.duration - (eventEntry.processingEnd - eventEntry.startTime)
        })

        if (eventEntry.interactionId > 0) {
          pendingInteractionRecords.set(eventEntry.interactionId, {
            id: nextInteractionRecordId,
            inpMs: eventEntry.duration,
            timestamp: toIsoFromEntryTime(eventEntry.startTime),
            selector: buildElementSelector(eventEntry.target)
          })
          nextInteractionRecordId += 1
        }

        trackVisualCompletion(
          eventEntry.startTime,
          eventEntry.interactionId,
          buildElementSelector(eventEntry.target)
        )
      }
    })

    eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 0 })
  } catch {
    // Performance event timing is not supported on all browser engines.
  }
}

function stopDebugLogging() {
  if (eventObserver) {
    eventObserver.disconnect()
    eventObserver = null
  }

  if (typeof window !== 'undefined') {
    console.log('[web-vitals][INP] debug tracking disabled')
  }

  pendingInteractionRecords.clear()
  activeVisualCompletion.clear()
}

export function setInpDebugEnabled(enabled: boolean) {
  inpDebugEnabled.value = enabled
}

export function initializeInpDebugLogging() {
  if (initialized) return
  initialized = true

  watch(
    inpDebugEnabled,
    (enabled) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
      }

      if (enabled) {
        startDebugLogging()
      } else {
        stopDebugLogging()
      }
    },
    { immediate: true }
  )
}
