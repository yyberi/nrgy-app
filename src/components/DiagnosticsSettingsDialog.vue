<template>
  <div
    v-if="open"
    class="perf-settings-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="perf-settings-title"
    @click.self="emit('close')"
  >
    <section class="perf-settings-panel">
      <header class="perf-settings-header">
        <h2 id="perf-settings-title" class="perf-settings-title">Diagnostics settings</h2>
        <button type="button" class="btn-close btn-close-white" aria-label="Close" @click="emit('close')"></button>
      </header>

      <div class="perf-settings-content">
        <div class="form-check form-switch">
          <input id="inp-debug-toggle" v-model="enabledModel" class="form-check-input" type="checkbox" />
          <label class="form-check-label" for="inp-debug-toggle">Enable INP and interaction response logging</label>
        </div>
        <p class="perf-settings-note">
          When enabled, the browser console logs INP updates and every captured interaction response timing.
        </p>

        <div class="perf-settings-table-wrap">
          <table class="perf-settings-table" aria-label="Interaction INP and paint timings">
            <thead>
              <tr>
                <th scope="col">id</th>
                <th scope="col">INP</th>
                <th scope="col">Paint</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="3" class="perf-settings-empty">No measurements yet</td>
              </tr>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ row.id }}</td>
                <td>{{ Math.round(row.inpMs) }} ms</td>
                <td>{{ Math.round(row.paintMs) }} ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface InteractionTimingRow {
  id: number
  inpMs: number
  paintMs: number
}

interface Props {
  open: boolean
  enabled: boolean
  rows: InteractionTimingRow[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  'update:enabled': [value: boolean]
}>()

const enabledModel = computed({
  get: () => props.enabled,
  set: (value: boolean) => emit('update:enabled', value)
})
</script>

<style scoped>
.perf-settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 9, 18, 0.78);
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 1.5rem;
  z-index: 1200;
}

.perf-settings-panel {
  width: min(28rem, calc(100vw - 2.2rem));
  border-radius: 12px;
  border: 1px solid rgba(151, 192, 241, 0.35);
  background: #121b2b;
  box-shadow: 0 20px 36px rgba(0, 0, 0, 0.5);
}

.perf-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(151, 192, 241, 0.2);
  padding: 0.75rem 0.95rem;
}

.perf-settings-title {
  margin: 0;
  color: #d9ebff;
  font-size: 1rem;
  font-weight: 700;
}

.perf-settings-content {
  padding: 0.9rem 0.95rem 1rem;
}

.perf-settings-content .form-check-label {
  color: #d9ebff;
  font-weight: 600;
}

.perf-settings-note {
  margin: 0.65rem 0 0;
  color: #a9bfdd;
  font-size: 0.84rem;
  line-height: 1.4;
}

.perf-settings-table-wrap {
  margin-top: 0.8rem;
  border: 1px solid rgba(151, 192, 241, 0.2);
  border-radius: 8px;
  overflow: auto;
  max-height: 18rem;
}

.perf-settings-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.perf-settings-table th,
.perf-settings-table td {
  padding: 0.42rem 0.55rem;
  border-bottom: 1px solid rgba(151, 192, 241, 0.15);
  color: #d9ebff;
  font-size: 0.82rem;
  text-align: left;
  white-space: nowrap;
}

.perf-settings-table th {
  position: sticky;
  top: 0;
  background: #1a2940;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.perf-settings-empty {
  text-align: center;
  color: #9fb5d2;
}
</style>
