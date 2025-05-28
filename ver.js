document.addEventListener('DOMContentLoaded', async () => {
  console.log('DER.js: startup');

  // 0) Plugin for dashed zero-lines
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
          ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
        }
      }
      // vertical zero (line charts)
      if (chart.config.type === 'line' && scales.x) {
        const x0 = scales.x.getPixelForValue(0);
        if (x0 >= left && x0 <= right) {
          ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // 1) Load CSVs
  const [sizeRes, velRes] = await Promise.all([
    fetch('data/vicarious_zpsize_avg_diff.csv'),
    fetch('data/vicarious_vel_avg_diff.csv')
  ]);
  if (!sizeRes.ok || !velRes.ok) {
    console.error('CSV load error', sizeRes.status, velRes.status);
    return;
  }
  const [sizeText, velText] = await Promise.all([ sizeRes.text(), velRes.text() ]);
  const sizeLines = sizeText.trim().split(/\r?\n/).filter(l=>l);
  const velLines  = velText .trim().split(/\r?\n/).filter(l=>l);

  // 2) Parse headers & data
  const subjects    = sizeLines[0].split(',').slice(1);
  const intensities = sizeLines[1].split(',').slice(1).map(Number);
  const dataSize    = sizeLines.slice(2).map(r=>r.split(',').map(Number));
  const dataVel     = velLines .slice(2).map(r=>r.split(',').map(Number));
  const times       = dataSize.map(r=>r[0]);

  // 3) Group by intensity
  const sizeByInt = {}, velByInt = {};
  intensities.forEach((int, idx) => {
    sizeByInt[int] = sizeByInt[int]||{};
    velByInt [int] = velByInt [int]||{};
    sizeByInt[int][subjects[idx]] = dataSize.map(r=>r[idx+1]);
    velByInt [int][subjects[idx]] = dataVel .map(r=>r[idx+1]);
  });

  // 4) Unique intensities
  const uniqueInts = Array.from(new Set(intensities)).sort((a,b)=>a-b);
  const firstInt   = uniqueInts[0];
  const lastInt    = uniqueInts[uniqueInts.length-1];

  // 5) Prepare global bounds for left plots
  const allSize = [], allVel = [];
  uniqueInts.forEach(i=>{
    Object.values(sizeByInt[i]).forEach(arr=>allSize.push(...arr));
    Object.values(velByInt[i]).forEach(arr=>allVel.push(...arr));
  });
  const sizeMax = Math.max(...allSize), velMax = Math.max(...allVel);

  // 6) Render left-side time-series with hover-highlight
  const chartsDiv = document.getElementById('charts');
  uniqueInts.forEach(intensity=>{
    const row = document.createElement('div');
    row.className = 'chart-row';

    // intensity label
    const lbl = document.createElement('div');
    lbl.className = 'row-label';
    lbl.textContent = `Intensity ${intensity} uA`;
    row.appendChild(lbl);

    ['Size','Velocity'].forEach(type => {
      const map   = (type==='Size' ? sizeByInt : velByInt)[intensity];
      const yMin  = type==='Size' ? -5 : -60;
      const yMax  = type==='Size' ?  20 : 60;
      const yTicks= type==='Size' ? [-5,0,20] : [-60,0,60];

      const chartDiv = document.createElement('div');
      chartDiv.className = 'chart';
      const canvas = document.createElement('canvas');
      chartDiv.appendChild(canvas);
      row.appendChild(chartDiv);

      // raw and average datasets
      const rawColor = 'rgba(0,99,132,0.7)';
      const rawDS = Object.entries(map).map(([subj, arr]) => ({
          label: subj,
          // Data as {x,y} pairs:
          data: arr.map((v, i) => ({ x: times[i], y: v })),
          // Draw a continuous line:
          showLine: true,
          fill: false,

          // Default style: faint green line
          borderColor: 'rgba(0,99,132,0.2)',
          borderWidth: 1,

          // Hide all point markers
          pointRadius: 0,
          pointHoverRadius: 0,

          // On hover, switch to solid green
          hoverBorderColor: 'green',
          hoverBorderWidth: 1
        }));
      const count = Object.values(map).length;
      const avgArr = times.map((_,i)=>
        Object.values(map).reduce((s,a)=>s+a[i],0)/count
      );
      const avgDS = {
        data: times.map((t,i)=>({x:t,y:avgArr[i]})),
        borderColor: 'rgba(0,99,132,0.7)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        hoverBorderWidth: 4
      };

      new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { datasets: [...rawDS, avgDS] },
        options: {
          maintainAspectRatio: false,
          // enable interaction & hover
          events: ['mousemove','mouseout','click','touchstart','touchmove','touchend'],
          interaction: { mode: 'dataset', intersect: false },
          hover: { mode: 'dataset', intersect: false },
          plugins: {
            zeroLinePlugin: {},
            title: {
              display: intensity===firstInt,
              text: type==='Size' ? 'Pupil size' : 'Locomotor Activity',
              font: { size: 14 }
            },
            tooltip: { enabled: false },
            legend: { display: false }
          },
          scales: {
            x: {
              type: 'linear', min: -1, max: 4,
              title: { display: intensity===lastInt, text: 'Time (s)' },
              ticks: { callback: v=>(v===-1||v===0||v===4? v : '') }
            },
            y: {
              min: yMin, max: yMax,
              title: { display: true, text: type==='Size'? 'Pupil size (a.u.)':'Locomotor Activity (a.u.)' },
              ticks: { callback: v=> (yTicks.includes(v)? v : '') }
            }
          }
        }
      });
    });

    chartsDiv.appendChild(row);
  });

  // 7) Compute peaks (1–2s)
  const idxWin = times.map((t,i)=>({t,i})).filter(o=>o.t>=1&&o.t<=2).map(o=>o.i);
  const sizePeaks = [], velPeaks = [];
  intensities.forEach((int,idx)=>{
    const s = dataSize.map(r=>r[idx+1]);
    const v = dataVel .map(r=>r[idx+1]);
    sizePeaks.push({x:int,y:Math.max(...idxWin.map(i=>s[i]))});
    velPeaks .push({x:int,y:Math.max(...idxWin.map(i=>v[i]))});
  });
  const avgSize = uniqueInts.map(i=>{
    const ys = sizePeaks.filter(p=>p.x===i).map(p=>p.y);
    return {x:i,y:ys.reduce((a,b)=>a+b,0)/ys.length};
  });
  const avgVel = uniqueInts.map(i=>{
    const ys = velPeaks.filter(p=>p.x===i).map(p=>p.y);
    return {x:i,y:ys.reduce((a,b)=>a+b,0)/ys.length};
  });

  // 8) Render right-side scatter (with only Y tooltip)
  function renderScatter(id, rawData, trendData, yMin, yMax) {
  new Chart(document.getElementById(id), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Raw Peaks',
          data: rawData,
          backgroundColor: 'rgba(0,99,132,0.7)',
          showLine: false
        },
        {
          label: 'Trend',
          data: trendData,
          borderColor: 'rgba(0,99,132,0.7)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          showLine: true
        }
      ]
    },
    options: {
      maintainAspectRatio: false,

      // only show tooltip for the directly hovered point
      interaction: {
        mode: 'nearest',
        intersect: true
      },

      plugins: {
        zeroLinePlugin: {},
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'nearest',
          intersect: true,
          callbacks: {
            label: context => `${context.parsed.y}`
          }
        }
      },

      scales: {
        x: {
          type: 'linear',
          min: -10,
          max: 550,
          title: { display: true, text: 'Intensity uA' },
          ticks: {
            callback: v => [0,50,150,300,500].includes(v) ? v : ''
          }
        },
        y: {
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: id === 'size-peaks-chart' ? 'Pupil Size Peak (a.u.)' : 'Locomotro Activity Peak (a.u.)'
          },
          ticks: {
            callback: v => (v === yMin || v === 0 || v === yMax) ? Math.round(v) : ''
          }
        }
      }
    }
  });
}

  renderScatter('size-peaks-chart', sizePeaks, avgSize, -5, 20);
  renderScatter('vel-peaks-chart', velPeaks, avgVel, -60, 60);

  console.log('DER.js: done');
});
