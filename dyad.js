

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Utility: ordinary-least-squares regression ─────────────────── */
  const ols = (xs, ys) => {
    const n   = xs.length;
    const mx  = xs.reduce((s, v) => s + v, 0) / n;
    const my  = ys.reduce((s, v) => s + v, 0) / n;
    const b1  = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
                xs.reduce((s, x)     => s + (x - mx) ** 2, 0);
    const b0  = my - b1 * mx;
    const min = Math.min(...xs), max = Math.max(...xs);
    return {
      slope: b1,
      intercept: b0,
      line: [
        { x: min, y: b0 + b1 * min },
        { x: max, y: b0 + b1 * max }
      ]
    };
  };

  /* ─── Factory: create one scatter-plot canvas via Chart.js ────────── */
  const makeScatter = ({
    id,                 // <canvas id="…">
    xs, ys,             // numeric arrays
    colour = '#007bff', // outline + regression colour
    square = false      // force square aspect (left rail)
  }) => {
    const { slope, intercept, line } = ols(xs, ys);

    new Chart(document.getElementById(id), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Dyads',
            data: xs.map((x, i) => ({ x, y: ys[i] })),
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHitRadius: 8,            // generous hover target
            pointBackgroundColor: 'transparent', // hollow markers
            pointBorderColor: colour,
            pointBorderWidth: 1.5,
            borderWidth: 0                // no connecting line
          },
          {
            label: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
            data: line,
            type: 'line',
            borderColor: colour,
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: !square,
        aspectRatio: square ? 1 : undefined,
        interaction: { mode: 'nearest', intersect: true }, // crisp tooltips
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Demonstrator' } },
          y: { title: { display: true, text: 'Observer' } }
        }
      }
    });
  };

  /* ─── Helper: find first column that matches a regex (case-insens.) ─ */
  const firstColumnMatching = (row, re) =>
    Object.keys(row).find(col => re.test(col)) || null;

  /* ═══════════════════════════════════════════════════════════════════
     1. Pupil (DER)  ↔  Pupil (VER)
     ═════════════════════════════════════════════════════════════════ */
  d3.csv('data/dyad_pupil.csv').then(csv => {
    const xKey = firstColumnMatching(csv[0], /demonstrator/i);
    const yKey = firstColumnMatching(csv[0], /observer/i);
    if (!xKey || !yKey) return;

    makeScatter({
      id: 'pupil-chart',
      xs: csv.map(d => +d[xKey]),
      ys: csv.map(d => +d[yKey]),
      square: true
    });
  });

  /* ═══════════════════════════════════════════════════════════════════
     2. Locomotor (DER)  ↔  Pupil (VER)
     ═════════════════════════════════════════════════════════════════ */
  Promise.all([
    d3.csv('data/dyad_loco.csv'),
    d3.csv('data/dyad_pupil.csv')
  ]).then(([loco, pupil]) => {
    const locoKey  = firstColumnMatching(loco [0], /demonstrator/i);
    const pupilKey = firstColumnMatching(pupil[0], /observer/i);
    if (!locoKey || !pupilKey) return;

    const xs = loco .map(d => +d[locoKey ]);
    const ys = pupil.map(d => +d[pupilKey]);
    const n  = Math.min(xs.length, ys.length);   // keep matched pairs only

    makeScatter({
      id:     'loco-chart',
      xs:     xs.slice(0, n),
      ys:     ys.slice(0, n),
      colour: '#59a14f',
      square: true
    });
  });

  /* ═══════════════════════════════════════════════════════════════════
     3. Brain-area grid  (4 per row, auto-generated canvases)
     ═════════════════════════════════════════════════════════════════ */
  d3.json('data/dyad_area.json').then(areas => {
    const grid = document.getElementById('area-plots');

    Object.entries(areas).forEach(([area, obj]) => {
      const canvasID = `area-${area}`;
      grid.insertAdjacentHTML(
        'beforeend',
        `<div class="scatter-plot">
           <h3>${area}</h3>
           <canvas id="${canvasID}"></canvas>
         </div>`
      );

      makeScatter({
        id: canvasID,
        xs: obj.dem,
        ys: obj.obs,
        colour: obj.color || '#e15759'
        // grid plots keep native aspect ratio
      });
    });
  });

});
