document.addEventListener('DOMContentLoaded', async () => {
  // 0) Dashed zero‐lines plugin
  Chart.register({
    id: 'zeroLinePlugin',
    afterDraw: chart => {
      const { ctx, chartArea:{ left, right, top, bottom }, scales } = chart;
      ctx.save();
      ctx.setLineDash([5,5]);
      ctx.strokeStyle = 'black';
      // horizontal at y=0
      if (scales.y) {
        const y0 = scales.y.getPixelForValue(0);
        if (y0 >= top && y0 <= bottom) {
          ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
        }
      }
      // vertical at x=0 for line charts
      if (chart.config.type === 'line' && scales.x) {
        const x0 = scales.x.getPixelForValue(0);
        if (x0 >= left && x0 <= right) {
          ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // 1) Time‐series averages for VER, VER+Occluder, Vision Only
  const files = [
    { path: 'data/mod_ts_multisensory.csv', label: 'VER',           color: 'green'  },
    { path: 'data/mod_ts_screen.csv',       label: 'VER+Occluder', color: 'blue'   },
    { path: 'data/mod_ts_vision_only.csv',  label: 'Vision Only',  color: 'orange' }
  ];
  const rowArrays = await Promise.all(
    files.map(f =>
      fetch(f.path)
        .then(res => res.text())
        .then(txt => d3.csvParseRows(txt))
    )
  );
  const times = rowArrays[0].slice(1).map(r => +r[0]);
  const tsDatasets = rowArrays.map((rows, i) => {
    const dataRows = rows.slice(1);
    const nSubs    = rows[0].length - 1;
    const avg = dataRows.map(r => {
      let sum = 0;
      for (let j = 1; j < r.length; j++) sum += +r[j];
      return sum / nSubs;
    });
    return {
      label: files[i].label,
      data: avg.map((v, idx) => ({ x: times[idx], y: v })),
      borderColor: files[i].color,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: files[i].color,
      showLine: true
    };
  });

  new Chart(
    document.getElementById('mod-timeseries-chart').getContext('2d'),
    {
      type: 'line',
      data: { datasets: tsDatasets },
      options: {
        maintainAspectRatio: false,
        plugins: {
          zeroLinePlugin: {},
          legend: { display: true }
        },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Time (s)' }
          },
          y: {
            title: { display: true, text: 'Evoked Response (avg)' }
          }
        }
      }
    }
  );

  // 2) Peaks scatter: raw + mean, with consistent colors
  const peakText = await fetch('data/mod_peaks.csv').then(r => r.text());
  const peaks    = d3.csvParse(peakText);

  const modeInfo = {
    VER:           { color: 'green',  rawColor: 'rgba(0,128,0,0.2)' },
    'VER+Occluder':{ color: 'blue',   rawColor: 'rgba(0,0,255,0.2)' },
    'Vision Only': { color: 'orange', rawColor: 'rgba(255,165,0,0.2)' }
  };

  const byMode = d3.groups(peaks, d => d.mode);
  const scatterDatasets = [];

  byMode.forEach(([mode, rows]) => {
    const info = modeInfo[mode] || { color: 'gray', rawColor: 'rgba(128,128,128,0.2)' };
    // raw points
    scatterDatasets.push({
      label: mode,
      data: rows.map(r => ({ x: mode, y: +r['0'] })),
      backgroundColor: info.rawColor,
      pointRadius: 4,
      showLine: false,
      _raw: true
    });
    // mean point
    const meanY = d3.mean(rows, r => +r['0']);
    scatterDatasets.push({
      label: mode,
      data: [{ x: mode, y: meanY }],
      backgroundColor: info.color,
      pointRadius: 8,
      showLine: false,
      _raw: false
    });
  });

  new Chart(
    document.getElementById('mod-peaks-chart').getContext('2d'),
    {
      type: 'scatter',
      data: { datasets: scatterDatasets },
      options: {
        maintainAspectRatio: false,
        plugins: {
          zeroLinePlugin: {},
          legend: {
            display: true,
            labels: {
              // show only the mean entries in legend
              filter: (legendItem, data) => {
                return !data.datasets[legendItem.datasetIndex]._raw;
              }
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: ctx => `${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            labels: byMode.map(([m]) => m),
            offset: true,
            title: { display: true, text: 'Condition' }
          },
          y: {
            title: { display: true, text: 'Peak Value' },
            ticks: { callback: v => Math.round(v) }
          }
        }
      }
    }
  );
});
