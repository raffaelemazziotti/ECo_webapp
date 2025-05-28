document.addEventListener('DOMContentLoaded', async () => {
  // 0) Dashed zero‐lines plugin (reuse from DER)
  Chart.register({
    id: 'zeroLinePlugin',
    afterDraw: chart => {
      const { ctx, chartArea:{left,right,top,bottom}, scales } = chart;
      ctx.save();
      ctx.setLineDash([5,5]);
      ctx.strokeStyle = 'black';
      // horizontal y=0
      if (scales.y) {
        const y0 = scales.y.getPixelForValue(0);
        if (y0 >= top && y0 <= bottom) {
          ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
        }
      }
      // vertical x=0 for line charts
      if (chart.config.type === 'line' && scales.x) {
        const x0 = scales.x.getPixelForValue(0);
        if (x0 >= left && x0 <= right) {
          ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // 1) Time-series: load & parse three CSVs
  const files = [
    { path: 'data/mod_ts_multisensory.csv', label: 'Multisensory', color: 'green' },
    { path: 'data/mod_ts_screen.csv',       label: 'Screen',       color: 'blue'  },
    { path: 'data/mod_ts_vision_only.csv',  label: 'Vision only',  color: 'orange'}
  ];

  // fetch & parse rows
  const rowArrays = await Promise.all(files.map(f =>
    fetch(f.path)
      .then(r => r.text())
      .then(txt => d3.csvParseRows(txt))
  ));

  // first column of each parsed array is time (same for all)
  const times = rowArrays[0].slice(1).map(row => +row[0]);

  // build one dataset per file: average across all subject‐columns
  const tsDatasets = rowArrays.map((rows, i) => {
    const header = rows[0];             // e.g. ['Unnamed: 0','0','1','2',...]
    const dataRows = rows.slice(1);     // each row: [time, subj0, subj1, ...]
    const nSubs = header.length - 1;
    // compute average at each time
    const avgSeries = dataRows.map(r => {
      let sum = 0;
      for (let j = 1; j < r.length; j++) sum += +r[j];
      return sum / nSubs;
    });
    return {
      label: files[i].label,
      data: avgSeries.map((v, idx) => ({ x: times[idx], y: v })),
      borderColor: files[i].color,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      showLine: true
    };
  });

  // render the time-series chart on the left
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

  // 2) Peaks scatter: load, group by mode, plot raw + mean
  const peaksText = await fetch('data/mod_peaks.csv').then(r => r.text());
  const peaks = d3.csvParse(peaksText);

  // group by d.mode
  const byMode = d3.groups(peaks, d => d.mode);
  const modes  = byMode.map(d => d[0]);

  // raw points dataset
  const rawDs = {
    label: 'Raw Peaks',
    data: peaks.map(r => ({ x: r.mode, y: +r['0'] })),
    backgroundColor: 'rgba(0,128,0,0.2)',
    pointRadius: 4,
    showLine: false
  };

  // mean per mode
  const meanDs = {
    label: 'Mean Peak',
    data: modes.map(m => {
      const vals = peaks.filter(r => r.mode === m).map(r => +r['0']);
      return { x: m, y: d3.mean(vals) };
    }),
    backgroundColor: 'green',
    pointRadius: 8,
    showLine: false
  };

  new Chart(
    document.getElementById('mod-peaks-chart').getContext('2d'),
    {
      type: 'scatter',
      data: { datasets: [rawDs, meanDs] },
      options: {
        maintainAspectRatio: false,
        plugins: {
          zeroLinePlugin: {},
          legend: { display: true },
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
            labels: modes,
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
