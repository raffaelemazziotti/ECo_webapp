document.addEventListener('DOMContentLoaded', () => {
  fetch('../data/ER_thresh.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(drawCharts)
    .catch(e => {
      console.error('Failed loading ER_thresh.json:', e);
      alert('Could not load threshold data.');
    });
});

function drawCharts(data) {
  const subjects = Object.keys(data);

  const derPupil = subjects.map(s => data[s].der.pupil.threshold);
  const derVel   = subjects.map(s => data[s].der.velocity.threshold);
  const verPupil = subjects.map(s => data[s].ver.pupil.threshold);

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  /* ===== 1) Average scatter (subjects + means) ===== */
  const cond = ['DER – Pupil', 'DER – Velocity', 'VER – Pupil'];

  const subjPts = subjects.flatMap((_, i) => [
    { x: cond[0], y: derPupil[i] },
    { x: cond[1], y: derVel[i]   },
    { x: cond[2], y: verPupil[i] }
  ]);
  const subjClr = subjPts.map(p =>
    p.x === cond[2] ? 'rgba(75,192,75,0.3)' : 'rgba(54,162,235,0.3)'
  );

  const meanPts = [
    { x: cond[0], y: mean(derPupil) },
    { x: cond[1], y: mean(derVel)   },
    { x: cond[2], y: mean(verPupil) }
  ];
  const meanClr = [
    'rgba(54,162,235,1)',
    'rgba(54,162,235,1)',
    'rgba(75,192,75,1)'
  ];

  new Chart(
    document.getElementById('avg-scatter-chart'),
    {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Subjects', data: subjPts, backgroundColor: subjClr, pointRadius: 4 },
          { label: 'Mean',     data: meanPts, backgroundColor: meanClr, pointRadius: 7 }
        ]
      },
      options: axisCat()
    }
  );

  /* ===== helper to build each correlation chart ===== */
  function corrChart(cid, xArr, yArr, ptColor, lineColor, xLabel, yLabel) {
    const pts = xArr.map((x, i) => ({ x, y: yArr[i] }));

    const mX = mean(xArr), mY = mean(yArr);
    let cov = 0, varX = 0;
    pts.forEach(p => {
      cov  += (p.x - mX) * (p.y - mY);
      varX += (p.x - mX) ** 2;
    });
    const slope = cov / varX;
    const intercept = mY - slope * mX;
    const line = [0, 1].map(x => ({ x, y: slope * x + intercept }));

    new Chart(
      document.getElementById(cid),
      {
        type: 'scatter',
        data: {
          datasets: [
            { label: 'Subjects', data: pts, backgroundColor: ptColor, pointRadius: 5 },
            {
              label: `Fit: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
              data: line, type: 'line', borderColor: lineColor,
              borderWidth: 2, pointRadius: 0, fill: false
            }
          ]
        },
        options: axisSq(xLabel, yLabel)
      }
    );
  }

  /* ===== 2) DER-Pupil × DER-Velocity ===== */
  corrChart(
    'corr-dp-dv',
    derPupil, derVel,
    'rgba(75,192,192,0.7)', 'rgba(200,0,0,0.8)',
    'DER – Pupil', 'DER – Velocity'
  );

  /* ===== 3) DER-Pupil × VER-Pupil ===== */
  corrChart(
    'corr-dp-vp',
    derPupil, verPupil,
    'rgba(153,102,255,0.7)', 'rgba(128,128,128,0.8)',
    'DER – Pupil', 'VER – Pupil'
  );

  /* ===== 4) DER-Velocity × VER-Pupil ===== */
  corrChart(
    'corr-dv-vp',
    derVel, verPupil,
    'rgba(255,205,86,0.7)', 'rgba(128,128,128,0.8)',
    'DER – Velocity', 'VER – Pupil'
  );
}

/* ----- Chart.js option helpers ----- */
function axisCat() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { type: 'category', title: { display: true, text: 'Condition' },offset:true },
      y: { min: 0, max: 1, title: { display: true, text: 'Threshold (0–1)' } }
    }
  };
}
function axisSq(xLab, yLab) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    scales: {
      x: { min: 0, max: 1, title: { display: true, text: xLab } },
      y: { min: 0, max: 1, title: { display: true, text: yLab } }
    }
  };
}