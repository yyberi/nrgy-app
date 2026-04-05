import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initializeInpDebugLogging } from '@/composables/inpDebug'

import HighchartsVue from "highcharts-vue";

import App from './App.vue'
import router from './router'

import 'bootstrap/dist/css/bootstrap.min.css'; // Bootstrap CSS
import 'bootstrap'
import './scss/styles.scss'
import './highcharts-theme';
// Preload splash image to reduce visible pop-in
import './assets/img/house.jpeg'

initializeInpDebugLogging()


const app = createApp(App)


app.use(createPinia())
app.use(router)
app.use(HighchartsVue);

app.mount('#app')
