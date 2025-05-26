// density.js

// helper: convert hex to rgba
function hexToRgba(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const int = parseInt(h, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Density page loaded.');

  // 0) Build areaNameMap from nodes.json
  let areaNameMap = {};
  try {
    const res = await fetch('data/nodes.json');
    const nodes = await res.json();
    nodes.forEach(n => { areaNameMap[n.id] = n.name; });
    console.log('Loaded areaNameMap:', areaNameMap);
  } catch (err) {
    console.error('Failed to load nodes.json:', err);
  }

  // Role color map
  const roleColor = {
    observer:     'rgba(0,99,132,0.7)',
    demonstrator: 'rgba(50,149,162,0.7)',
    no_shock:     'gray'
  };

  //
  // 1) Percent Activation (horizontal bar)
  //
  Papa.parse('data/struct_activation_perc.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const structures = [...new Set(data.map(d => d.structure))];
      const groups     = [...new Set(data.map(d => d.group))];
      const datasets   = groups.map((grp, i) => ({
        label: grp,
        data: structures.map(s => {
          const row = data.find(r => r.structure === s && r.group === grp);
          return row ? parseFloat(row['0']) : 0;
        }),
        backgroundColor: roleColor[grp] || `rgba(${50*i},${99+50*i},${132+30*i},0.7)`
      }));

      const ctx = document.getElementById('activationChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: { labels: structures, datasets },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            axis: 'y',
            intersect: false
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Percentage Activation' }
            },
            y: {
              title: { display: true, text: 'Brain Structure' }
            }
          }
        }
      });
    },
    error: err => console.error('Error loading activation CSV:', err)
  });

  //
  // 2) Density per Structure (vertical bars with full-name tooltips)
  //
  Papa.parse('data/area_activation_density.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const container   = document.getElementById('structure-charts');
      const structures  = [...new Set(data.map(d => d.structure))];

      structures.forEach(struct => {
        const rows    = data.filter(r => r.structure === struct);
        const areas   = [...new Set(rows.map(r => r.acronyms))];
        const roles   = [...new Set(rows.map(r => r.role))];
        const structColor = rows[0].color;
        const gridColor   = hexToRgba(structColor, 0.2);

        // Create wrapper
        const wrap = document.createElement('div');
        wrap.className = 'structure-plot';
        wrap.innerHTML = `
          <h3>${struct}</h3>
          <canvas id="density-${struct.replace(/\W+/g,'_')}"></canvas>
        `;
        container.appendChild(wrap);

        // Build datasets
        const datasets = roles.map((role, i) => ({
          label: role.replace('_',' '),
          data: areas.map(area => {
            const row = rows.find(r => r.acronyms === area && r.role === role);
            return row ? parseFloat(row.density) : 0;
          }),
          backgroundColor: roleColor[role] || `rgba(${50*i},${99+50*i},${132+30*i},0.7)`
        }));

        // Render chart
        const ctx2 = wrap.querySelector('canvas').getContext('2d');
        new Chart(ctx2, {
          type: 'bar',
          data: { labels: areas, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              axis: 'x',
              intersect: false
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: structColor }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  title: items => {
                    const acro = items[0].label;
                    return areaNameMap[acro] || acro;
                  },
                  label: item => `${item.dataset.label}: ${item.parsed.y}`
                }
              }
            },
            scales: {
              x: {
                title: { display: true, text: 'Area', color: structColor },
                ticks: { color: structColor },
                grid:  { color: gridColor },
                border:{ color: structColor }
              },
              y: {
                title: { display: true, text: 'Density', color: structColor },
                ticks: { color: structColor },
                grid:  { color: gridColor },
                border:{ color: structColor }
              }
            }
          }
        });
      });
    },
    error: err => console.error('Error loading density CSV:', err)
  });

  //
  // 3 Volcanos
  //

  function createVolcanoChart(canvasId, rawData) {
    if (!rawData.length) return;

    // 1) find CSV columns
    const keys  = Object.keys(rawData[0]);
    const fcKey = keys.find(k => k.toLowerCase().includes('fold'));
    const pvKey = keys.find(k => k.toLowerCase().includes('pval'));
    const thr   = Math.log10(0.05);

    // 2) build points
    const pts = rawData.map(d => {
      const fc = parseFloat(d[fcKey]), pv = parseFloat(d[pvKey]);
      if (isNaN(fc)||isNaN(pv)||fc<=0||pv<=0) return null;
      return {
        x:    Math.log10(fc),
        y:    Math.log10(pv),
        name: d.area
      };
    }).filter(Boolean);
    if (!pts.length) return;

    // 3) compute extents (include 0 and thr), add 10% padding
    let xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    let xMin = Math.min(Math.min(...xs), 0),
        xMax = Math.max(Math.max(...xs), 0);
    let yMin = Math.min(Math.min(...ys), thr),
        yMax = Math.max(Math.max(...ys), thr);
    const xPad = (xMax - xMin)*0.1, yPad = (yMax - yMin)*0.1;
    xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;

    // 4) pick color based on canvasId
    const baseColor = canvasId.includes('dem')
      ? roleColor.demonstrator
      : roleColor.observer;

    // 5) scatter dataset: solid above thr, hollow below
    const scatterDs = {
      type: 'scatter',
      label: '',
      data: pts,
      pointRadius:      5,
      pointHoverRadius: 7,
      hitRadius:        8,
      backgroundColor: pts.map(p => p.y <= thr ? baseColor : 'transparent'),
      borderColor:     pts.map(p => baseColor),
      borderWidth:      1
    };

    // 6) threshold lines
    const thrLineDs = {
      type:'line',
      data:[ {x:xMin,y:thr}, {x:xMax,y:thr} ],
      borderDash:[6,4], borderColor:'#444', borderWidth:1,
      pointRadius:0, fill:false
    };
    const zeroLineDs = {
      type:'line',
      data:[ {x:0,y:yMin}, {x:0,y:yMax} ],
      borderDash:[6,4], borderColor:'#444', borderWidth:1,
      pointRadius:0, fill:false
    };

    // 7) render mixed scatter+lines
    new Chart(
      document.getElementById(canvasId).getContext('2d'),
      {
        type: 'scatter',
        data: { datasets: [scatterDs, thrLineDs, zeroLineDs] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'nearest', axis:'xy', intersect:true },
          plugins: {
            legend: { display:false },
            tooltip: {
              displayColors:false,
              callbacks: {
                title: () => '',
                label: ctx => ctx.raw.name
              }
            }
          },
          scales: {
            x: { title:{display:true,text:'log₁₀(Fold Change)'}, min:xMin, max:xMax },
            y: { reverse:true, title:{display:true,text:'log₁₀(p-value)'}, min:yMin, max:yMax }
          }
        }
      }
    );
  }

    // load demonstrator
    Papa.parse('data/fold_change_dem_pval.csv', {
      download: true, header: true, skipEmptyLines: true,
      complete: ({ data }) => createVolcanoChart('volcano-dem', data),
      error: err => console.error('Error loading dem CSV:', err)
    });

    // load observer
    Papa.parse('data/fold_change_obs_pval.csv', {
      download: true, header: true, skipEmptyLines: true,
      complete: ({ data }) => createVolcanoChart('volcano-obs', data),
      error: err => console.error('Error loading obs CSV:', err)
    });

});
