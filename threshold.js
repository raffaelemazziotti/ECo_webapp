// data/threshold.js
// Fetch ER_thresh.json and render:
// 1) Scatter of per‐subject thresholds + colored mean dots for DER–Pupil, DER–Velocity, VER–Pupil
// 2) Scatter + regression line correlating DER–Pupil vs DER–Velocity
// Both charts have the threshold axis fixed from 0 to 1.

document.addEventListener('DOMContentLoaded', () => {
  fetch('data/ER_thresh.json')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      const subjects = Object.keys(data);
      const derPupil = subjects.map(id => data[id].der.pupil.threshold);
      const derVel   = subjects.map(id => data[id].der.velocity.threshold);
      const verPupil = subjects.map(id => data[id].ver.pupil.threshold);
      const mean     = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

      // —— 1) Threshold scatter with colored subjects & means ——
      const condLabels = ['DER – Pupil', 'DER – Velocity', 'VER – Pupil'];

      // Per‐subject points
      const subjPoints = subjects.flatMap((_, i) => [
        { x: condLabels[0], y: derPupil[i] },
        { x: condLabels[1], y: derVel[i]   },
        { x: condLabels[2], y: verPupil[i] }
      ]);

      // Colors: VER–Pupil points green, others blue
      const subjColors = subjPoints.map(pt =>
        pt.x === condLabels[2]
          ? 'rgba(75, 192, 75, 0.3)'
          : 'rgba(54, 162, 235, 0.3)'
      );

      // Mean points
      const avgPoints = [
        { x: condLabels[0], y: mean(derPupil) },
        { x: condLabels[1], y: mean(derVel)   },
        { x: condLabels[2], y: mean(verPupil) }
      ];
      const avgColors = [
        'rgba(54, 162, 235, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(75, 192, 75, 1)'
      ];

      new Chart(
        document.getElementById('avg-threshold-chart').getContext('2d'),
        {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'Individual Subjects',
                data: subjPoints,
                backgroundColor: subjColors,
                pointRadius: 4
              },
              {
                label: 'Mean Threshold',
                data: avgPoints,
                backgroundColor: avgColors,
                pointRadius: 7
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'category',
                labels: condLabels,
                title: { display: true, text: 'Condition' }
              },
              y: {
                min: 0,
                max: 1,
                title: { display: true, text: 'Threshold (0–1)' }
              }
            }
          }
        }
      );

      // —— 2) DER–Pupil vs DER–Velocity scatter + regression ——
      const pts = subjects.map((_, i) => ({ x: derPupil[i], y: derVel[i] }));
      const xMean = mean(derPupil), yMean = mean(derVel);
      let num = 0, den = 0;
      derPupil.forEach((x, i) => {
        const y = derVel[i];
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
      });
      const slope = num / den;
      const intercept = yMean - slope * xMean;
      const xVals = [Math.min(...derPupil), Math.max(...derPupil)];
      const linePts = xVals.map(x => ({ x, y: slope * x + intercept }));

      new Chart(
        document.getElementById('corr-chart').getContext('2d'),
        {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'DER–Pupil vs DER–Velocity',
                data: pts,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                pointRadius: 5
              },
              {
                label: `Fit: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
                data: linePts,
                type: 'line',
                fill: false,
                pointRadius: 0,
                borderWidth: 2,
                borderColor: 'rgba(200, 0, 0, 0.8)'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: 'DER – Pupil Threshold' },
                min: 0,
                max: 1
              },
              y: {
                min: 0,
                max: 1,
                title: { display: true, text: 'DER – Velocity Threshold' }
              }
            }
          }
        }
      );
    })
    .catch(err => {
      console.error('Failed loading thresholds JSON:', err);
      alert('Could not load threshold data.');
    });
});
