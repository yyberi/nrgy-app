<template>
  <div class="card-wrapper">
    <header
      v-if="title || subtitle || $slots.title || $slots.header || $slots.actions"
      class="card-header"
    >
      <div class="card-heading">
        <slot name="title">
          <h5 v-if="title" class="card-title">{{ title }}</h5>
        </slot>
        <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="header">
        <slot name="actions" />
      </slot>
    </header>
    <div :class="contentClass" :style="gridStyle">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title?: string
  subtitle?: string
  layout?: 'grid' | 'vertical'
  columns?: number
}
const props = defineProps<Props>()

const contentClass = computed(() => props.layout === 'vertical' ? 'card-content vertical' : 'card-content')
const gridStyle = computed(() => {
  if (props.layout === 'vertical') return undefined
  if (props.columns && props.columns > 0) {
    return { gridTemplateColumns: `repeat(${props.columns}, 1fr)` }
  }
  return undefined
})
</script>

<style scoped>
.card-wrapper {
  background: #454545;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  height: 100%;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.card-heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ad0ff;
}

.card-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: #a6c7ff;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-content { 
  display: grid; 
  gap: 1rem; 
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); 
  flex: 1;
  min-height: 0;
}
.card-content.vertical { 
  display: flex; 
  flex-direction: column; 
  padding: 0;
  gap: 0;
  flex: 1;
  min-height: 0;
}

/* Allow chart containers inside to stretch nicely */
.card-content :deep(.chart-container) {
  height: 100%;
}

.card-footer {
  border-top: 1px solid #333;
  padding-top: .5rem;
  font-size: 0.875rem;
  color: #aaa;
}

@media (max-width: 600px) {
  .card-content { grid-template-columns: 1fr; }
}
</style>
