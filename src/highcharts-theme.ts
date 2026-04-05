// src/highcharts-theme.ts
import Highcharts from 'highcharts';
import 'highcharts/modules/boost';

// Define the dark theme
const darkTheme: Highcharts.Options = {
  chart: {
    backgroundColor: '#1a1a1a',
    // backgroundColor: '#505050ff',
    spacingBottom: 9,
    style: {
      color: '#e0e0e0',
    },
  },
  title: {
    style: {
      color: '#e0e0e0',
    },
  },
  xAxis: {
    lineColor: '#e0e0e0',
    labels: {
      style: {
        color: '#e0e0e0',
      },
    },
  },
  yAxis: {
    gridLineColor: '#333',
    labels: {
      style: {
        color: '#e0e0e0',
      },
    },
    title: {
      style: {
        color: '#e0e0e0',
      },
    },
  },
  legend: {
    itemStyle: {
      color: '#e0e0e0',
    },
    itemHoverStyle: {
      color: '#fff',
    },
  },
  tooltip: {
    backgroundColor: '#333',
    style: {
      color: '#e0e0e0',
    },
  },
};

// Apply the theme globally
Highcharts.setOptions({
  // Display axis/timestamps in the browser's local time (incoming data timestamps are UTC)
  // Cast to any to satisfy TS; Highcharts runtime accepts useUTC
  time: { useUTC: false } as any,
  accessibility: {
    enabled: false
  },
  credits: {
    enabled: true,
    position: {
      align: 'right',
      verticalAlign: 'bottom',
      x: -6,
      y: -2,
    },
    style: {
      fontSize: '8px',
      color: '#8a8a8a',
    },
  },
  boost: {
    useGPUTranslations: true,
    usePreallocated: true,
  } as any,
  plotOptions: {
    series: {
      // Force Boost on so all charts use the boosted rendering path.
      boostThreshold: 240,
      animation: false,
    },
  },
  lang: {
    decimalPoint: '.',
    thousandsSep: ' ',
  },
  ...darkTheme,
});

export default Highcharts;
