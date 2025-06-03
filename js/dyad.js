document.addEventListener('DOMContentLoaded', () => {

  // ─── OLS Regression ──────────────────────────────
  const ols = (xs, ys) => {
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const b1 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
               xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const b0 = my - b1 * mx;
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

  // ─── Create a scatterplot ─────────────────────────
  const makeScatter = ({ id, xs, ys, colour = '#007bff', square = false, normalize = false }) => {
  const normalizeArr = (arr) => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return arr.map(v => (v - min) / (max - min));
  };

  const normXs = normalize ? normalizeArr(xs) : xs;
  const normYs = normalize ? normalizeArr(ys) : ys;

  const { slope, intercept, line } = ols(normXs, normYs);

  const canvas = document.getElementById(id);
  const box = canvas.getBoundingClientRect();
  canvas.width = box.width;
  canvas.height = box.height;

  new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Dyads',
          data: normXs.map((x, i) => ({
            x, y: normYs[i],
            rawX: xs[i],
            rawY: ys[i]
          })),
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 8,
          pointBackgroundColor: 'transparent',
          pointBorderColor: colour,
          pointBorderWidth: 1.5
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
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return normalize
                ? `x: ${d.rawX.toFixed(2)}, y: ${d.rawY.toFixed(2)}`
                : `x: ${d.x.toFixed(2)}, y: ${d.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Demonstrator' },
          min: normalize ? -0.1 : undefined,
          max: normalize ? 1.1 : undefined
        },
        y: {
          title: { display: true, text: 'Observer' },
          min: normalize ? -0.1 : undefined,
          max: normalize ? 1.1 : undefined
        }
      }
    }
  });
};


  const firstColumnMatching = (row, re) =>
    Object.keys(row).find(col => re.test(col)) || null;

  // ─── 1. Pupil vs Pupil ────────────────────────────
  d3.csv('../data/dyad_pupil.csv').then(csv => {
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

  // ─── 2. Loco vs Pupil ─────────────────────────────
  Promise.all([
    d3.csv('../data/dyad_loco.csv'),
    d3.csv('../data/dyad_pupil.csv')
  ]).then(([loco, pupil]) => {
    const xKey = firstColumnMatching(loco[0], /demonstrator/i);
    const yKey = firstColumnMatching(pupil[0], /observer/i);
    if (!xKey || !yKey) return;

    const xs = loco.map(d => +d[xKey]);
    const ys = pupil.map(d => +d[yKey]);
    const n = Math.min(xs.length, ys.length);

    makeScatter({
      id: 'loco-chart',
      xs: xs.slice(0, n),
      ys: ys.slice(0, n),
      colour: '#59a14f',
      square: true
    });
  });

  // ─── 3. Brain-Area Grid ───────────────────────────
  d3.json('../data/dyad_area.json').then(areas => {
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
        colour: obj.color || '#e15759',
        normalize: true
      });
    });
  });

});
