<template>
  <section class="summary-panel-card">
    <header class="summary-panel-card__header">
      <div class="summary-panel-card__header-row">
        <h4 class="summary-panel-card__title">{{ title }}</h4>
        <div class="summary-panel-card__header-center">
          <slot name="header-center" />
        </div>
      </div>
      <p v-if="subtitle" class="summary-panel-card__subtitle">{{ subtitle }}</p>
    </header>

    <div class="summary-panel-card__content">
      <slot :name="`page-${currentPage}`">
        <slot />
      </slot>
    </div>

    <footer v-if="showPager" class="summary-panel-card__footer">
      <div class="btn-group btn-group-sm" role="group" aria-label="Page selection">
        <button
          v-for="page in pages"
          :key="page.key"
          type="button"
          class="btn"
          :class="currentPage === page.key ? 'btn-primary' : 'btn-outline-secondary'"
          @click="selectPage(page.key)"
        >{{ page.label }}</button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SummaryPanelPage } from '@/types/ui-summary'

interface Props {
  title: string
  subtitle?: string
  pages?: SummaryPanelPage[]
  activePage?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:activePage': [page: string]
}>()

const showPager = computed(() => (props.pages?.length ?? 0) > 1)

const currentPage = computed(() => {
  if (props.activePage) return props.activePage
  if (props.pages && props.pages.length > 0) return props.pages[0].key
  return 'default'
})

function selectPage(page: string) {
  emit('update:activePage', page)
}
</script>

<style scoped>
.summary-panel-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #333;
  border-radius: 8px;
  background: #151515;
  padding: 0.5rem;
}

.summary-panel-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.45rem;
}

.summary-panel-card__header-row {
  position: relative;
  min-height: 1.25rem;
  display: flex;
  align-items: center;
}

.summary-panel-card__header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  pointer-events: none;
}

.summary-panel-card__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ad0ff;
}

.summary-panel-card__subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: #a6c7ff;
}

.summary-panel-card__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.summary-panel-card__content > * {
  flex: 1;
  min-height: 0;
}

.summary-panel-card__footer {
  display: flex;
  justify-content: center;
  margin-top: 0.4rem;
}

.btn-group .btn {
  font-size: 0.72rem;
  padding: 0.3rem 0.6rem;
}

.btn-group .btn.btn-outline-secondary {
  background-color: #1a1a1a;
  border-color: #555;
  color: #ccc;
}

.btn-group .btn.btn-outline-secondary:hover {
  background-color: #2a2a2a;
  color: #fff;
}

.btn-group .btn.btn-primary {
  background-color: #2a5a8a;
  border-color: #2a5a8a;
  color: #fff;
}
</style>
