<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import houseImg from '@/assets/img/house.jpeg'

const visible = ref(true)
const widthEnough = ref(true)
const emit = defineEmits<{ (e: 'finished'): void }>()

let hideTimer: number | null = null
let resizeHandler: (() => void) | null = null

const clearHideTimer = () => {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const scheduleHide = () => {
  if (typeof window === 'undefined') return
  clearHideTimer()
  hideTimer = window.setTimeout(() => {
    visible.value = false
    hideTimer = null
  }, 1000)
}

const evaluateViewport = () => {
  if (typeof window === 'undefined') return
  widthEnough.value = window.innerWidth >= 1366
  if (widthEnough.value) {
    if (visible.value) {
      scheduleHide()
    }
  } else {
    clearHideTimer()
    visible.value = true
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  evaluateViewport()
  resizeHandler = () => {
    evaluateViewport()
  }
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  clearHideTimer()
  if (typeof window !== 'undefined' && resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})

const widthMessage = computed(() =>
  'Your screen resolution is below 1366px wide. Please expand your window or use a larger display to view the dashboard.'
)
</script>

<template>
  <transition name="fade" @after-leave="emit('finished')">
    <div
      v-if="visible"
      class="splash-screen d-flex flex-column justify-content-center align-items-center text-center"
    >
      <template v-if="widthEnough">
        <h1 class="display-6 text-light mb-4">Loading nrgy app...</h1>
        <img :src="houseImg" class="splash-image mb-4" alt="House" width="640" height="480" />
        <div class="spinner-border text-light" role="status" aria-hidden="true"></div>
      </template>
      <template v-else>
        <h1 class="display-6 text-light mb-4">Resolution too small</h1>
        <p class="text-light lead w-75 mx-auto">{{ widthMessage }}</p>
      </template>
    </div>
  </transition>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 2000;
  padding: 1.5rem;
}
.splash-image { 
  max-width: 640px; 
  width: 100%; 
  height: auto; 
  border-radius: 18px; 
  object-fit: cover; 
  box-shadow: 0 4px 24px -4px rgba(255,255,255,0.25);
  border: 2px solid rgba(255,255,255,0.2);
}
@media (max-width: 768px) {
  .splash-image { max-width: 180px; }
  h1.display-6 { font-size: 1.5rem; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.6s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.lead { font-size: 1.1rem; }
</style>
