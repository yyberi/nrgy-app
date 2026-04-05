<template>
  <GridTemplate :title="title" :subtitle="subtitle">
    <div class="summary-body">
      <p class="summary-value">{{ mainValue }}</p>
      <template v-if="metaItems && metaItems.length > 0">
        <p v-for="(meta, index) in metaItems" :key="index" class="summary-meta" :class="{ 'summary-section': meta.isSection }">
          {{ meta.label }}: {{ meta.value }}
        </p>
      </template>
      <p v-if="rangeLabel" class="summary-range">{{ rangeLabel }}</p>
    </div>
  </GridTemplate>
</template>

<script setup lang="ts">
import GridTemplate from './GridTemplate.vue'
import type { MetaItem } from '@/types/ui-summary'

interface Props {
  title: string
  subtitle?: string
  mainValue: string
  metaItems?: MetaItem[]
  rangeLabel?: string
}

defineProps<Props>()
</script>

<style scoped>
.summary-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.summary-value {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
  word-break: break-word;
}

.summary-meta {
  font-size: 0.85rem;
  color: #c0c0c0;
  margin: 0;
}

.summary-section {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.summary-range {
  font-size: 0.75rem;
  color: #8a8a8a;
  margin: 0;
}
</style>
