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
    const res = await fetch('nodes.json');
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
});
