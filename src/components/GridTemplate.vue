<template>
  <section class="grid-template" role="group">
    <header v-if="title || subtitle || $slots.header" class="grid-template__header">
      <div class="grid-template__heading">
        <h3 v-if="title" class="grid-template__title">{{ title }}</h3>
        <p v-if="subtitle" class="grid-template__subtitle">{{ subtitle }}</p>
      </div>
      <slot name="header" />
    </header>
    <div class="grid-template__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="grid-template__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
interface GridTemplateProps {
  title?: string
  subtitle?: string
}

defineProps<GridTemplateProps>()
</script>

<style scoped>
.grid-template {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.grid-template__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.grid-template__heading {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.grid-template__title {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ad0ff;
  margin: 0;
  white-space: pre-line;
  line-height: 1.25;
}

.grid-template__subtitle {
  font-size: 0.75rem;
  color: #a6c7ff;
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-template__content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}

.grid-template__footer {
  margin-top: 0.5rem;
}

:deep(.chart-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: -5px;
}

:deep(.chart-container > div) {
  flex: 1;
}
</style>
