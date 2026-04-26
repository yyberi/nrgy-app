<script setup lang="ts">
import { ref, shallowRef, type Component } from 'vue'
import SplashScreen from './components/SplashScreen.vue'

// Start loading the main bundle immediately (at module evaluation) for earliest possible fetch
const mainImportPromise = import('./Main.vue')

const showSplash = ref(true)
const MainComponent = shallowRef<Component | null>(null)

mainImportPromise.then(m => {
  MainComponent.value = m.default
})

const handleSplashFinished = () => { showSplash.value = false }
</script>

<template>
  <SplashScreen v-if="showSplash" @finished="handleSplashFinished" />
  <component
    v-if="MainComponent"
    :is="MainComponent"
    class="main-root"
    :class="{ 'is-hidden': showSplash }"
  />
</template>

<style scoped>
.main-root { opacity: 1; transition: opacity .45s ease; }
.main-root.is-hidden { opacity: 0; }
</style>
