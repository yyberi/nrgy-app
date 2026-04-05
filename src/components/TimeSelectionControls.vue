<template>
  <div class="time-controls">
    <div class="center-controls">
      <div class="control-group">
        <span class="control-label">Length</span>
        <div class="btn-group btn-group-sm" role="group" aria-label="Duration selection">
          <button
            v-for="option in durationOptions"
            :key="option.value"
            type="button"
            class="btn"
            :class="duration === option.value ? 'btn-primary' : 'btn-outline-secondary'"
            :disabled="!rangeReady"
            @click="$emit('duration-change', option.value)"
          >{{ option.label }}</button>
        </div>
      </div>
      
      <div class="control-group" v-show="timelineReady">
        <span class="control-label">Year</span>
        <div class="btn-group btn-group-sm" role="group" aria-label="Year selection">
          <button
            v-for="year in yearOptions"
            :key="year"
            type="button"
            class="btn"
            :class="selectedYear === year && duration !== 'all' ? 'btn-primary' : 'btn-outline-secondary'"
            :disabled="!rangeReady || duration === 'all'"
            @click="$emit('year-change', year)"
          >{{ year }}</button>
        </div>
      </div>
    </div>
    
    <div class="right-controls" v-show="timelineReady">
      <button class="btn-reset" @click="$emit('reset')" title="Reset Highcharts zoom (Esc)">↺</button>
    </div>
  </div>
</template>

<script setup lang="ts">
type DurationKey = '1d' | '1w' | '1m' | '1y' | 'all'

interface Props {
  duration: DurationKey
  selectedYear: number
  durationOptions: Array<{ value: DurationKey; label: string }>
  yearOptions: number[]
  rangeReady: boolean
  timelineReady: boolean
}

defineProps<Props>()

defineEmits<{
  'duration-change': [value: DurationKey]
  'year-change': [year: number]
  'reset': []
}>()
</script>

<style scoped>
.time-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.center-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1 1 auto;
  min-width: 0;
  justify-content: center;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex: 0 0 auto;
  white-space: nowrap;
}

.control-group {
  flex-shrink: 0;
}

.control-label {
  font-weight: 600;
  color: #9ad0ff;
  white-space: nowrap;
  font-size: 0.75rem;
  margin-right: 0.5rem;
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

.btn-group .btn.btn-outline-secondary:hover:not(:disabled) {
  background-color: #2a2a2a;
  color: #fff;
}

.btn-group .btn.btn-outline-secondary:disabled {
  opacity: 0.5;
}

.btn-group .btn.btn-primary {
  background-color: #2a5a8a;
  border-color: #2a5a8a;
  color: #fff;
}

.year-selector {
  flex-shrink: 0;
}

.range-label {
  font-size: 0.8rem;
  color: #ccc;
  white-space: nowrap;
  font-weight: 500;
}

.btn-reset {
  padding: 0.35rem 0.75rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 4px;
  color: #9ad0ff;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.btn-reset:hover {
  background: #2a5a8a;
  color: #fff;
  border-color: #2a5a8a;
}

@media (max-width: 980px) {
  .time-controls {
    flex-wrap: wrap;
  }
  
  .center-controls {
    order: 1;
    flex-basis: 100%;
    justify-content: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .right-controls {
    order: 2;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .center-controls {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .range-label {
    font-size: 0.7rem;
  }
}
</style>
