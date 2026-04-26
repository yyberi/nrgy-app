<template>
  <div class="chart-container">
    <div :id="chartId"></div>
  </div>
</template>

<script lang="ts">
import Highcharts from '@/highcharts-theme'
import { onMounted, ref } from 'vue'

export default {
  name: 'DemoChart',
  setup() {
    const chartId = ref(`chart-container-${Math.random().toString(36).substr(2, 9)}`) // Generate a unique ID

    onMounted(() => {
      Highcharts.setOptions({
        lang: {
          decimalPoint: '.',
          thousandsSep: ',',
        },
      })

      Highcharts.chart({
        chart: {
          renderTo: chartId.value,
          type: 'column',
          // backgroundColor: null,
          reflow: true, // Ensure the chart resizes with its container
        },
        title: {
          text: 'Simple Column Chart',
          style: {
            color: '#e0e0e0',
          },
        },
        xAxis: {
          categories: [
            'Apples',
            'Bananas',
            'Oranges',
            'Pears',
            'Grapes',
            'Mangoes',
            'Berries',
            'Peaches',
            'Plums',
            'Cherries',
            'Kiwis',
          ],
          labels: {
            style: {
              color: '#e0e0e0',
            },
          },
        },
        yAxis: {
          title: {
            text: 'Fruit eaten',
            style: {
              color: '#e0e0e0',
            },
          },
          labels: {
            style: {
              color: '#e0e0e0',
            },
          },
        },
        series: [
          {
            type: 'column',
            name: 'Jane',
            data: [1, 0, 4, 5, 6, 7, 4, 9, 1, 2, 3],
          },
          {
            type: 'column',
            name: 'John',
            data: [5, 7, 3, 4, 5, 6, 4, 9, 1, 2, 3],
          },
        ],
      })
    })

    return {
      chartId,
    }
  },
}
</script>

<style scoped>
.chart-container {
  border: 1px solid #fff; /* Add a visible border */
  border-radius: 15px;
  display: block; /* Ensure it behaves as a block element */
  overflow: hidden;
}

.chart-container > div {
  width: 100%; /* Ensure the chart fills the container */
  height: 100%; /* Ensure the chart fills the container */
}
</style>
