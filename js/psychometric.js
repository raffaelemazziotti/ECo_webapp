
import { levenbergMarquardt as lm } from
  'https://cdn.jsdelivr.net/npm/ml-levenberg-marquardt@4.1.3/+esm';

/* 4-parameter logistic */
const logistic = ([x0, k, L, b]) => x =>
  L / (1 + Math.exp(-k * (x - x0))) + b;

/* default dataset (demo) */
const DEFAULT_I = [0, 50, 150, 300, 500];
const DEFAULT_R = [0.6, 0.7, 5.2, 21.5, 41.4];

let fitChart;

/* ------------------------------------------------------------- *
 *  Event wiring
 * ------------------------------------------------------------- */

document.getElementById('fit-btn').addEventListener('click', runFit);

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('intensity-input').value = DEFAULT_I.join(' ');
  document.getElementById('response-input').value  = DEFAULT_R.join(' ');
  runFit();
});

/* ------------------------------------------------------------- *
 *  Main routine
 * ------------------------------------------------------------- */

function runFit() {
  /* -------- 1) Parse & sanity-check --------------------------- */
  const intensities = parseInput('intensity-input');
  const responses   = parseInput('response-input');
  if (!checkInputs(intensities, responses)) return;

  /* -------- 2) Normalise (exactly as before) ------------------ */
  const xMax  = Math.max(...intensities);
  const xVals = intensities.map(x => x / xMax);

  const base  = responses[0];
  const yTemp = responses.map(y => y - base);
  const yMax  = Math.max(...yTemp);
  const yVals = yTemp.map(y => y / yMax);

  /* -------- 3) Dynamic bounds & initial guess ---------------- */
  const xMinScaled = Math.min(...xVals);
  const xMaxScaled = Math.max(...xVals);
  const x0Init     = (xMinScaled + xMaxScaled) / 2;

  /* -------- 4) Bounded LM fit -------------------------------- */
  const options = {
    damping: 1.5,
    initialValues: [x0Init, 1, 0.5, 0],                 // x0, k, L, b
    minValues:   [xMinScaled, 0,   xMinScaled, xMinScaled],
    maxValues:   [xMaxScaled, 500, xMaxScaled, xMaxScaled],
    maxIterations: 1000,
    gradientDifference: 1e-2
  };

  const { parameterValues: [x0, k, L, b] } =
        lm({ x: xVals, y: yVals }, logistic, options);

  const model = logistic([x0, k, L, b]);

  /* -------- 5) R² goodness-of-fit ----------------------------- */
  const yHat = xVals.map(model);
  const r2   = 1 -
    yVals.reduce((s, y, i) => s + (y - yHat[i]) ** 2, 0) /
    yVals.reduce((s, y)     => s + (y - average(yVals)) ** 2, 0);

  /* -------- 6) Prediction curve ------------------------------ */
  const xPred = Array.from({ length: 200 }, (_, i) => i / 199);
  const yPred = xPred.map(model);

  drawChart(xVals, yVals, xPred, yPred, x0, model(x0));

  /* -------- 7) NEW: rescaled threshold ----------------------- */
  const thresholdIntensity = x0 * xMax;     // raw-unit threshold

  updateTable({
    slope: k,
    threshold_scaled: x0,          // existing value (0-1 scale)
    threshold_intensity: thresholdIntensity,  // ← new table row
    L,
    b,
    r_squared: r2
  });
}

/* ------------------------------------------------------------- *
 *  Helpers
 * ------------------------------------------------------------- */

function parseInput(id) {
  return document.getElementById(id).value
    .trim().split(/[\s,;]+/).filter(Boolean).map(Number);
}

function checkInputs(intensities, responses) {
  const err = document.getElementById('input-error');
  if (intensities.length === 0 || responses.length === 0) {
    err.textContent = 'Enter numbers in both fields.'; return false;
  }
  if (intensities.length !== responses.length) {
    err.textContent = 'Arrays must have same length.'; return false;
  }
  if (intensities.some(isNaN) || responses.some(isNaN)) {
    err.textContent = 'Inputs must be valid numbers.'; return false;
  }
  err.textContent = ''; return true;
}

const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

/* ----- Chart.js drawing (unchanged) ----- */
function drawChart(xData, yData, xPred, yPred, thrX, thrY) {
  const ctx = document.getElementById('psych-chart');
  const data = {
    datasets: [
      { label: 'Data',
        type: 'scatter',
        data: xData.map((x, i) => ({ x, y: yData[i] })),
        backgroundColor: '#666',
        pointRadius: 4 },
      { label: 'Fit',
        type: 'line',
        data: xPred.map((x, i) => ({ x, y: yPred[i] })),
        borderColor: 'red',
        borderWidth: 2,
        pointRadius: 0 },
      { label: 'Threshold',
        type: 'line',
        data: [{ x: thrX, y: -0.05 }, { x: thrX, y: thrY }],
        borderColor: '#000',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0 }
    ]
  };

  const config = {
    data,
    options: {
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Normalised intensity' }, min: -0.05, max: 1.05 },
        y: { title: { display: true, text: 'Normalised response'  }, min: -0.1,  max: 1.05 }
      },
      plugins: { legend: { display: false } }
    }
  };

  if (fitChart) fitChart.destroy();
  fitChart = new Chart(ctx, config);
}

/* ----- Results table (unchanged logic) ----- */
function updateTable(obj) {
  const tbody = document.querySelector('#summary-table tbody');
  tbody.innerHTML = '';
  Object.entries(obj).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${v.toFixed(4)}</td>`;
    tbody.appendChild(tr);
  });
}