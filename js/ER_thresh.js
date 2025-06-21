// er_thresh.js

function hideSpinner() {
  document.getElementById('loading-overlay').style.display = 'none';
  //document.querySelector('main').style.display = 'flex';
}

async function loadData() {
  const response = await fetch('../data/ER_thresh.json');
  const data = await response.json();

  const container = document.getElementById('subjects-grid');

  Object.keys(data).forEach(subjectId => {
    const subjectData = data[subjectId];

    // Create subject block
    const subjectBlock = document.createElement('div');
    subjectBlock.className = 'subject-block';

    subjectBlock.innerHTML = `
      <h2>Subject ${subjectId}</h2>
      <div class="charts-row">
        <div class="chart-container"><canvas id="chart-${subjectId}-pupil"></canvas></div>
        <div class="chart-container"><canvas id="chart-${subjectId}-velocity"></canvas></div>
        <div class="chart-container"><canvas id="chart-${subjectId}-ver"></canvas></div>
        <div class="report-box" id="report-${subjectId}"></div>
      </div>
    `;

    container.appendChild(subjectBlock);

    // Render charts
    renderScatterWithFit(`chart-${subjectId}-pupil`, subjectData.der.pupil, '#28a745');   // green
    renderScatterWithFit(`chart-${subjectId}-velocity`, subjectData.der.velocity, '#28a745'); // green
    renderScatterWithFit(`chart-${subjectId}-ver`, subjectData.ver.pupil, '#007bff');      // blue

    // Fill report box
    const reportDiv = document.getElementById(`report-${subjectId}`);
    reportDiv.innerHTML = `
      <strong>DER - Pupil</strong><br>
      Threshold: ${formatNumber(subjectData.der.pupil.threshold)}<br>
      R²: ${formatNumber(subjectData.der.pupil.r_squared)}<br><br>
      
      <strong>DER - Locomotor</strong><br>
      Threshold: ${formatNumber(subjectData.der.velocity.threshold)}<br>
      R²: ${formatNumber(subjectData.der.velocity.r_squared)}<br><br>
      
      <strong>VER - Pupil</strong><br>
      Threshold: ${formatNumber(subjectData.ver.pupil.threshold)}<br>
      R²: ${formatNumber(subjectData.ver.pupil.r_squared)}
    `;
  });

  hideSpinner();
}

function renderScatterWithFit(canvasId, series, fitColor, chartTitle) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Data',
          data: series.x.map((xVal, i) => ({ x: xVal, y: series.y[i] })),
          backgroundColor: '#333',
          pointRadius: 4,
          showLine: false
        },
        {
          label: 'Fit',
          data: series.x_pred.map((xVal, i) => ({ x: xVal, y: series.y_pred[i] })),
          type: 'line',
          borderColor: fitColor,
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: chartTitle,
          font: {
            size: 14
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Norm Intensity'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Norm Response'
          }
        }
      }
    }
  });
}

function formatNumber(value) {
  return Number(value).toFixed(4);
}

loadData();
