document.addEventListener('DOMContentLoaded', async () => {
  console.log('DER.js: startup');

  // 0) plugin for dashed zero‐lines
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
        if (y0>=top && y0<=bottom) {
          ctx.beginPath();
          ctx.moveTo(left, y0);
          ctx.lineTo(right, y0);
          ctx.stroke();
        }
      }
      // vertical zero on line charts
      if (chart.config.type==='line' && scales.x) {
        const x0 = scales.x.getPixelForValue(0);
        if (x0>=left && x0<=right) {
          ctx.beginPath();
          ctx.moveTo(x0, top);
          ctx.lineTo(x0, bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // 1) fetch CSVs
  const [sizeRes, velRes] = await Promise.all([
    fetch('data/aversive_zpsize_avg_diff.csv'),
    fetch('data/aversive_vel_avg_diff.csv')
  ]);
  if (!sizeRes.ok || !velRes.ok) {
    console.error('Failed to fetch CSVs', sizeRes.status, velRes.status);
    return;
  }
  const [sizeText, velText] = await Promise.all([ sizeRes.text(), velRes.text() ]);
  const sizeLines = sizeText.trim().split(/\r?\n/).filter(l=>l);
  const velLines  = velText .trim().split(/\r?\n/).filter(l=>l);

  // 2) parse headers & data
  const subjects    = sizeLines[0].split(',').slice(1);
  const intensities = sizeLines[1].split(',').slice(1).map(Number);
  const dataSize    = sizeLines.slice(2).map(r => r.split(',').map(Number));
  const dataVel     = velLines .slice(2).map(r => r.split(',').map(Number));
  const times       = dataSize.map(r=>r[0]);

  // 3) group by intensity
  const sizeByInt={}, velByInt={};
  intensities.forEach((int,idx)=>{
    sizeByInt[int] = sizeByInt[int]||{};
    velByInt [int] = velByInt [int]||{};
    sizeByInt[int][subjects[idx]] = dataSize.map(r=>r[idx+1]);
    velByInt [int][subjects[idx]] = dataVel .map(r=>r[idx+1]);
  });

  // 4) unique intensities
  const uniqueInts = Array.from(new Set(intensities)).sort((a,b)=>a-b);

  // 5) render time series on left
  const chartsDiv = document.getElementById('charts');
  uniqueInts.forEach(intensity => {
    const row = document.createElement('div');
    row.className = 'chart-row';

    // label
    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = `Intensity ${intensity}`;
    row.appendChild(label);

    ['Size','Velocity'].forEach(type=>{
      const map   = type==='Size'? sizeByInt[intensity] : velByInt[intensity];
      const yMin  = type==='Size'? -20 : -60;
      const yMax  = type==='Size'?  80 : 350;
      const yTicks= type==='Size'? [-20,0,80] : [-60,0,350];

      const chartDiv = document.createElement('div');
      chartDiv.className = 'chart';
      const canvas = document.createElement('canvas');
      canvas.style.pointerEvents='none';
      chartDiv.appendChild(canvas);
      row.appendChild(chartDiv);

      // raw traces
      const rawColor='rgba(0,128,0,0.2)';
      const rawDS = Object.values(map).map(arr=>({
        data: times.map((t,i)=>({x:t,y:arr[i]})),
        borderColor: rawColor, borderWidth:1, pointRadius:0, tension:0.3, fill:false
      }));

      // average
      const count=Object.values(map).length;
      const avgArr=times.map((_,i)=>
        Object.values(map).reduce((s,a)=>s+a[i],0)/count
      );
      const avgDS={
        data: times.map((t,i)=>({x:t,y:avgArr[i]})),
        borderColor:'green', borderWidth:2, pointRadius:0, tension:0.3, fill:false
      };

      new Chart(canvas.getContext('2d'), {
        type:'line',
        data:{datasets:[...rawDS,avgDS]},
        options:{
          maintainAspectRatio:false,
          plugins:{ zeroLinePlugin:{}, legend:{display:false} },
          scales:{
            x:{
              type:'linear',
              min:-1, max:4,
              title:{ display:false },
              ticks:{
                callback:v=> (v===-1||v===0||v===4? v : '')
              }
            },
            y:{
              min:yMin, max:yMax,
              title:{ display:true, text: type==='Size'? 'Pupil size':'Locomotor Activity' },
              ticks:{ callback:v=> (yTicks.includes(v)? v: '') }
            }
          }
        }
      });
    });

    chartsDiv.appendChild(row);
  });

  // 6) compute peaks
  const idxWin = times.map((t,i)=>({t,i})).filter(o=>o.t>=1&&o.t<=2).map(o=>o.i);
  const sizePeaks=[], velPeaks=[];
  intensities.forEach((int,idx)=>{
    const s=dataSize.map(r=>r[idx+1]);
    const v=dataVel .map(r=>r[idx+1]);
    sizePeaks.push({x:int,y:Math.max(...idxWin.map(i=>s[i]))});
    velPeaks .push({x:int,y:Math.max(...idxWin.map(i=>v[i]))});
  });
  // trend
  const avgSize = uniqueInts.map(i=>{
    const ys=sizePeaks.filter(p=>p.x===i).map(p=>p.y);
    return {x:i,y:ys.reduce((a,b)=>a+b,0)/ys.length};
  });
  const avgVel = uniqueInts.map(i=>{
    const ys=velPeaks.filter(p=>p.x===i).map(p=>p.y);
    return {x:i,y:ys.reduce((a,b)=>a+b,0)/ys.length};
  });

  // 7) render peaks on right
  function renderScatter(id, raw, trend, yMax){
    new Chart(document.getElementById(id), {
      type:'scatter',
      data:{datasets:[
        {label:'Raw',data:raw,backgroundColor:'rgba(0,128,0,0.2)'},
        {label:'Trend',data:trend,borderColor:'green',borderWidth:2,pointRadius:3,showLine:true,fill:false}
      ]},
      options:{
        maintainAspectRatio:false,
        layout:{padding:{left:20,right:20,top:10,bottom:10}},
        plugins:{ zeroLinePlugin:{}, legend:{display:false} },
        scales:{
          x:{
            type:'linear', min:-10, max:550,
            title:{display:true,text:'Intensity'},
            ticks:{
              callback:v=>([0,50,150,300,500].includes(v)? v:'')
            }
          },
          y:{
            min:0, max:yMax,
            title:{display:true,text:id==='size-peaks-chart'? 'Pupil Size Peak':'Velocity Peak'},
            ticks:{ callback:v=>([0,yMax].includes(v)? Math.round(v): '') }
          }
        }
      }
    });
  }

  renderScatter('size-peaks-chart', sizePeaks, avgSize, 80);
  renderScatter('vel-peaks-chart', velPeaks, avgVel, 350);

  console.log('DER.js: done');
});
