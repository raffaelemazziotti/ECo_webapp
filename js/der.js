function hideSpinner() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
  const main = document.querySelector('main');
  if (main) main.style.display = 'block'; // stack sections vertically
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // --- dashed zero-line plugin
    Chart.register({
      id: 'zeroLinePlugin',
      afterDraw: chart => {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales) return;
        const { left, right, top, bottom } = chartArea;
        ctx.save();
        ctx.setLineDash([5, 5]);
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

    // --- load CSVs
    const [sizeRes, velRes] = await Promise.all([
      fetch('../data/aversive_zpsize_avg_diff.csv'),
      fetch('../data/aversive_vel_avg_diff.csv')
    ]);
    if (!sizeRes.ok || !velRes.ok) {
      console.error('CSV load error', sizeRes.status, velRes.status);
      hideSpinner();
      return;
    }
    const [sizeText, velText] = await Promise.all([sizeRes.text(), velRes.text()]);

    // --- parse CSVs
    const sizeLines = sizeText.trim().split(/\r?\n/).filter(Boolean);
    const velLines  = velText.trim().split(/\r?\n/).filter(Boolean);

    const subjects    = sizeLines[0].split(',').slice(1);
    const intensities = sizeLines[1].split(',').slice(1).map(Number);
    const dataSize    = sizeLines.slice(2).map(r => r.split(',').map(Number));
    const dataVel     = velLines .slice(2).map(r => r.split(',').map(Number));
    const times       = dataSize.map(r => r[0]);

    // group by intensity -> subject -> array
    const sizeByInt = {}, velByInt = {};
    intensities.forEach((int, idx) => {
      sizeByInt[int] = sizeByInt[int] || {};
      velByInt[int]  = velByInt[int]  || {};
      sizeByInt[int][subjects[idx]] = dataSize.map(r => r[idx + 1]);
      velByInt[int][subjects[idx]]  = dataVel .map(r => r[idx + 1]);
    });

    const uniqueInts = Array.from(new Set(intensities)).sort((a, b) => a - b);

    // --- helpers
    const mkAvg = mapObj => {
      const n = Object.values(mapObj).length;
      return times.map((_, i) => Object.values(mapObj).reduce((s, a) => s + a[i], 0) / n);
    };

    const mkRawDatasets = (mapObj) =>
      Object.entries(mapObj).map(([label, arr]) => ({
        label,
        data: arr.map((y, i) => ({ x: times[i], y })),
        showLine: true,
        borderColor: 'rgba(0,128,0,0.2)',
        borderWidth: 1,
        pointRadius: 0
      }));

    const mkAvgDataset = (avgArr, color = 'green') => ({
      data: times.map((t, i) => ({ x: t, y: avgArr[i] })),
      borderColor: color,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    });

    const makeLineChart = (canvas, datasets, yMin, yMax, yLabel) => new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets },
      options: {
        maintainAspectRatio: false,
        plugins: {
          zeroLinePlugin: {},
          legend: { display: false },
          tooltip: { enabled: false }
        },
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear', min: -1, max: 4,
            title: { display: true, text: 'Time (s)' },
            ticks: { callback: v => (v === -1 || v === 0 || v === 4 ? v : '') }
          },
          y: {
            min: yMin, max: yMax,
            title: { display: true, text: yLabel }
          }
        }
      }
    });

    // --- time-series per intensity (two charts per row)
    const chartsDiv = document.getElementById('charts');
    uniqueInts.forEach(intensity => {
      // intensity subtitle
      const lbl = document.createElement('h4');
      lbl.className = 'intensity-label';
      lbl.textContent = `Intensity ${intensity} µA`;
      chartsDiv.appendChild(lbl);

      // row container
      const row = document.createElement('div');
      row.className = 'chart-row';

      // pupil (size)
      {
        const cell = document.createElement('div');
        cell.className = 'chart-cell';
        const c = document.createElement('canvas');
        cell.appendChild(c);
        row.appendChild(cell);

        const map = sizeByInt[intensity];
        const avg = mkAvg(map);
        const raw = mkRawDatasets(map);
        const avgDS = mkAvgDataset(avg, 'green');
        makeLineChart(c, [...raw, avgDS], -20, 80, 'Pupil size (a.u.)');
      }

      // locomotor (velocity)
      {
        const cell = document.createElement('div');
        cell.className = 'chart-cell';
        const c = document.createElement('canvas');
        cell.appendChild(c);
        row.appendChild(cell);

        const map = velByInt[intensity];
        const avg = mkAvg(map);
        const raw = mkRawDatasets(map);
        const avgDS = mkAvgDataset(avg, 'green');
        makeLineChart(c, [...raw, avgDS], -60, 350, 'Locomotor activity (a.u.)');
      }

      chartsDiv.appendChild(row);
    });

    // --- peaks (1–2s window) for top scatter
    const winIdx = times.map((t, i) => ({ t, i })).filter(o => o.t >= 1 && o.t <= 2).map(o => o.i);
    const sizePeaks = [], velPeaks = [];
    intensities.forEach((int, idx) => {
      const s = dataSize.map(r => r[idx + 1]);
      const v = dataVel .map(r => r[idx + 1]);
      sizePeaks.push({ x: int, y: Math.max(...winIdx.map(i => s[i])) });
      velPeaks .push({ x: int, y: Math.max(...winIdx.map(i => v[i])) });
    });
    const avgSize = uniqueInts.map(i => {
      const ys = sizePeaks.filter(p => p.x === i).map(p => p.y);
      return { x: i, y: ys.reduce((a, b) => a + b, 0) / ys.length };
    });
    const avgVel = uniqueInts.map(i => {
      const ys = velPeaks.filter(p => p.x === i).map(p => p.y);
      return { x: i, y: ys.reduce((a, b) => a + b, 0) / ys.length };
    });

    const renderScatter = (id, rawData, trendData, yMin, yMax, yLabel) =>
      new Chart(document.getElementById(id).getContext('2d'), {
        type: 'scatter',
        data: {
          datasets: [
            { label: 'Raw Peaks', data: rawData, backgroundColor: 'rgba(0,128,0,0.2)', showLine: false },
            { label: 'Trend', data: trendData, borderColor: 'green', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, showLine: true }
          ]
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: true },
          plugins: { zeroLinePlugin: {}, legend: { display: false }, tooltip: { enabled: true } },
          scales: {
            x: { type: 'linear', min: -10, max: 550, title: { display: true, text: 'Intensity (µA)' } },
            y: { min: yMin, max: yMax, title: { display: true, text: yLabel } }
          }
        }
      });

    renderScatter('size-peaks-chart', sizePeaks, avgSize, -20, 80, 'Pupil size peak (a.u.)');
    renderScatter('vel-peaks-chart',  velPeaks,  avgVel,  -60, 350, 'Locomotor activity peak (a.u.)');

    hideSpinner();
  } catch (e) {
    console.error(e);
    hideSpinner();
  }
});
