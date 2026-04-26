/// <reference types="vite/client" />

import type { DefineComponent } from 'vue'
import './src/types/vue-grid-layout-v3'

declare module '*.vue' {
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
