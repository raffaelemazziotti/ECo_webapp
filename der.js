document.addEventListener('DOMContentLoaded', async () => {
  console.log('DER.js: startup');

  // 0) Adjust layout: make left column narrower, right column wider
  const leftCol = document.querySelector('.left-charts');
  const rightCol = document.querySelector('.right-charts');
  if (leftCol && rightCol) {
    leftCol.style.flex = '1 1 30%';
    rightCol.style.flex = '1 1 70%';
  }

  // 1) Disable all Chart.js interactions globally
  Chart.defaults.plugins.tooltip.enabled = false;
  Chart.defaults.hover.mode = null;
  Chart.defaults.events = [];

  // 2) Global plugin for dashed zero‐lines
  Chart.register({
    id: 'zeroLinePlugin',
    afterDraw: chart => {
      const ctx = chart.ctx;
      const { left, right, top, bottom } = chart.chartArea;
      const scales = chart.scales;
      ctx.save();
      ctx.setLineDash([5,5]);
      ctx.strokeStyle = 'black';
      // horizontal zero
      if (scales.y) {
        const y0 = scales.y.getPixelForValue(0);
        if (y0 >= top && y0 <= bottom) {
          ctx.beginPath();
          ctx.moveTo(left, y0);
          ctx.lineTo(right, y0);
          ctx.stroke();
        }
      }
      // vertical zero (only on line charts)
      if (chart.config.type === 'line' && scales.x) {
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

  // 3) Load CSVs
  const [sizeRes, velRes] = await Promise.all([
    fetch('data/aversive_zpsize_avg_diff.csv'),
    fetch('data/aversive_vel_avg_diff.csv')
  ]);
  if (!sizeRes.ok || !velRes.ok) {
    console.error('Failed to fetch CSVs', sizeRes.status, velRes.status);
    return;
  }
  const [sizeText, velText] = await Promise.all([ sizeRes.text(), velRes.text() ]);

  // 4) Parse lines & data
  const sizeLines = sizeText.trim().split(/\r?\n/).filter(l => l);
  const velLines  = velText .trim().split(/\r?\n/).filter(l => l);
  const subjects    = sizeLines[0].split(',').slice(1);
  const intensities = sizeLines[1].split(',').slice(1).map(Number);
  const dataSize    = sizeLines.slice(2).map(r => r.split(',').map(Number));
  const dataVel     = velLines .slice(2).map(r => r.split(',').map(Number));
  const times       = dataSize.map(r => r[0]);

  // 5) Group by intensity
  const sizeByInt = {}, velByInt = {};
  intensities.forEach((intensity, idx) => {
    sizeByInt[intensity] = sizeByInt[intensity] || {};
    velByInt [intensity] = velByInt [intensity] || {};
    sizeByInt[intensity][subjects[idx]] = dataSize.map(r => r[idx+1]);
    velByInt [intensity][subjects[idx]] = dataVel .map(r => r[idx+1]);
  });

  // 6) Unique intensities & global bounds
  const uniqueInts = Array.from(new Set(intensities)).sort((a,b)=>a-b);
  const firstInt   = uniqueInts[0];
  const lastInt    = uniqueInts[uniqueInts.length - 1];

  const allSize = [], allVel = [];
  uniqueInts.forEach(int => {
    Object.values(sizeByInt[int]).forEach(arr => allSize.push(...arr));
    Object.values(velByInt[int]).forEach(arr => allVel.push(...arr));
  });
  const sizeMin = Math.min(...allSize), sizeMax = Math.max(...allSize);
  const velMin  = Math.min(...allVel),  velMax  = Math.max(...allVel);

  // 7) Render left‐side time‐series
  const chartsDiv = document.getElementById('charts');
  uniqueInts.forEach(intensity => {
    const row = document.createElement('div');
    row.className = 'chart-row';

    // intensity label (rotated)
    const labelDiv = document.createElement('div');
    labelDiv.className = 'row-label';
    labelDiv.textContent = `Intensity ${intensity}`;
    row.appendChild(labelDiv);

    ['Size','Velocity'].forEach(type => {
      const map      = (type === 'Size' ? sizeByInt : velByInt)[intensity];
      const chartDiv = document.createElement('div');
      chartDiv.className = 'chart';
      const canvas   = document.createElement('canvas');
      // no interaction
      canvas.style.pointerEvents = 'none';
      chartDiv.appendChild(canvas);
      row.appendChild(chartDiv);

      // prepare datasets
      const rawColor = 'rgba(0,128,0,0.2)';
      const rawDS = Object.values(map).map(arr => ({
        data: times.map((t,i) => ({ x: t, y: arr[i] })),
        borderColor: rawColor,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        showLine: true
      }));

      const count  = Object.values(map).length;
      const avgArr = times.map((_,i) =>
        Object.values(map).reduce((sum,a) => sum + a[i], 0) / count
      );
      const avgDS = {
        data: times.map((t,i) => ({ x: t, y: avgArr[i] })),
        borderColor: 'green',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        showLine: true
      };

      // Y‐bounds and tick rounding
      const yMin = type === 'Size' ? sizeMin : velMin;
      const yMax = type === 'Size' ? sizeMax : velMax;

      new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { datasets: [...rawDS, avgDS] },
        options: {
          maintainAspectRatio: false,
          events: [],         // disable interactions
          plugins: {
            zeroLinePlugin: {},
            title: {
              display: intensity === firstInt,
              text: type === 'Size' ? 'Pupil size' : 'Locomotor Activity',
              font: { size: 14 }
            },
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: intensity === lastInt,
                text: 'Time (s)'
              },
              ticks: {
                display: intensity === lastInt
              }
            },
            y: {
              min: yMin,
              max: yMax,
              ticks: {
                callback: v => Math.round(v)
              },
              title: {
                display: true,
                text: type === 'Size'
                  ? ['Pupil size', `Intensity: ${intensity}`]
                  : ['Locomotor Activity', `Intensity: ${intensity}`]
              }
            }
          }
        }
      });
    });

    chartsDiv.appendChild(row);
  });

  // 8) Compute peaks
  const idxWindow = times
    .map((t,i) => ({ t, i }))
    .filter(o => o.t >= 1 && o.t <= 2)
    .map(o => o.i);

  const sizePeaks = [], velPeaks = [];
  intensities.forEach((int, idx) => {
    const s = dataSize.map(r => r[idx+1]);
    const v = dataVel .map(r => r[idx+1]);
    sizePeaks.push({ x: int, y: Math.max(...idxWindow.map(i => s[i])) });
    velPeaks .push({ x: int, y: Math.max(...idxWindow.map(i => v[i])) });
  });

  // average trends
  const avgSize = uniqueInts.map(int => {
    const ys = sizePeaks.filter(p => p.x === int).map(p => p.y);
    return { x: int, y: ys.reduce((a,b) => a + b, 0) / ys.length };
  });
  const avgVel  = uniqueInts.map(int => {
    const ys = velPeaks.filter(p => p.x === int).map(p => p.y);
    return { x: int, y: ys.reduce((a,b) => a + b, 0) / ys.length };
  });

  // 9) Resize right-hand canvases and render scatter + trend
  ['size-peaks-chart','vel-peaks-chart'].forEach(id => {
    const c = document.getElementById(id);
    if (c) {
      c.style.width = '100%';
      c.style.height = '350px';
    }
  });

  function renderScatter(id, rawData, trendData, yLabel) {
    new Chart(document.getElementById(id), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Raw Peaks',
            data: rawData,
            backgroundColor: 'rgba(0,128,0,0.2)',
            showLine: false
          },
          {
            label: 'Trend',
            data: trendData,
            borderColor: 'green',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            showLine: true,
            backgroundColor: 'green'
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        events: [],
        plugins: {
          zeroLinePlugin: {},
          tooltip: { enabled: false },
          legend: { display: false }
        },
        scales: {
          x: { title: { display: true, text: 'Intensity' } },
          y: {
            title: { display: true, text: yLabel },
            ticks: { callback: v => Math.round(v) }
          }
        }
      }
    });
  }

  renderScatter('size-peaks-chart', sizePeaks, avgSize, 'Pupil Size Peak');
  renderScatter('vel-peaks-chart', velPeaks, avgVel, 'Velocity Peak');

  console.log('DER.js: done');
});
