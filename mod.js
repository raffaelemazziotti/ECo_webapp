document.addEventListener('DOMContentLoaded', async () => {
  // --- 0) Re-register the dashed‐zero plugin ---
  Chart.register({
    id: 'zeroLinePlugin',
    afterDraw: chart => {
      const {ctx, chartArea:{left,right,top,bottom}, scales} = chart;
      ctx.save();
      ctx.setLineDash([5,5]);
      ctx.strokeStyle = 'black';
      // horizontal at y=0
      if (scales.y) {
        const y0 = scales.y.getPixelForValue(0);
        if (y0 >= top && y0 <= bottom) {
          ctx.beginPath();
          ctx.moveTo(left, y0);
          ctx.lineTo(right, y0);
          ctx.stroke();
        }
      }
      // vertical at x=0 for line charts
      if (chart.config.type==='line' && scales.x) {
        const x0 = scales.x.getPixelForValue(0);
        if (x0 >= left && x0 <= right) {
          ctx.beginPath();
          ctx.moveTo(x0, top);
          ctx.lineTo(x0, bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // --- 1) Time-series: load & average three CSVs ---
  const files = [
    {path:'data/mod_ts_multisensory.csv', label:'Multisensory', color:'green'},
    {path:'data/mod_ts_screen.csv',       label:'Screen',       color:'blue'},
    {path:'data/mod_ts_vision_only.csv',  label:'Vision only',  color:'orange'}
  ];

  // fetch & parse
  const texts = await Promise.all(files.map(f=>fetch(f.path).then(r=>r.text())));
  const tables = texts.map(txt=>d3.csvParse(txt));

  // time axis from "Unnamed: 0"
  const time = tables[0].map(r=>+r['Unnamed: 0']);

  // compute average series
  const tsDatasets = tables.map((tbl,i) => {
    const keys = Object.keys(tbl[0]).filter(k=>'Unnamed: 0'!==k);
    const avg = tbl.map(row => {
      const sum = keys.reduce((s,k)=>s + (+row[k]),0);
      return sum / keys.length;
    });
    return {
      label: files[i].label,
      data: avg.map((v,j)=>({ x: time[j], y: v })),
      borderColor: files[i].color,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      showLine: true
    };
  });

  // render line chart
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

  // --- 2) Peaks scatter: load & plot ---
  const peakText = await fetch('data/mod_peaks.csv').then(r=>r.text());
  const peaksTbl = d3.csvParse(peakText);

  // group by mode
  const byMode = d3.groups(peaksTbl, d=>d.mode);
  const modes  = byMode.map(d=>d[0]);

  // raw points
  const rawDs = {
    label: 'Raw Peaks',
    data: peaksTbl.map(r => ({ x: r.mode, y: +r['0'] })),
    backgroundColor: 'rgba(0,128,0,0.2)',
    pointRadius: 4,
    showLine: false
  };

  // mean per mode
  const meanDs = {
    label: 'Mean Peak',
    data: modes.map(m => {
      const vals = peaksTbl.filter(r=>r.mode===m).map(r=>+r['0']);
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
