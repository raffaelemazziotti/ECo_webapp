// Load CSV and JSON, then plot scatter
Promise.all([
  fetch('../data/hits_data.csv').then(response => response.text()),
  fetch('../data/nodes.json').then(response => response.json())
]).then(([csvData, nodesData]) => {
  // Build area lookup map
  const areaMap = {};
  nodesData.forEach(node => {
    areaMap[node.id] = {
      name: node.name,
      structure: node.structure,
      color: node.color
    };
  });

  // Parse CSV
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true
  });

  // Group data per structure
  const structureDataMap = {};
  parsed.data.forEach(row => {
    const acro = row.acro;
    const nodeInfo = areaMap[acro] || {};
    const structure = nodeInfo.structure || row.structure;
    const color = nodeInfo.color || row.color;

    if (!structureDataMap[structure]) {
      structureDataMap[structure] = {
        label: structure,
        data: [],
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false
      };
    }

    structureDataMap[structure].data.push({
      x: parseFloat(row.Authorities_z_score),
      y: parseFloat(row.Hubs_z_score),
      label: nodeInfo.name || acro,
      authoritiesP: row.Authorities_p_value,
      hubsP: row.Hubs_p_value
    });
  });

  // Determine axis min/max for diagonal
  const allX = parsed.data.map(row => parseFloat(row.Authorities_z_score));
  const allY = parsed.data.map(row => parseFloat(row.Hubs_z_score));

  const axisMin = Math.min(Math.min(...allX), Math.min(...allY));
  const axisMax = Math.max(Math.max(...allX), Math.max(...allY));

  // Build dataset array
  const datasets = Object.values(structureDataMap);

  // Add diagonal line
  datasets.push({
    label: 'y = x',
    data: [
      { x: axisMin, y: axisMin },
      { x: axisMax, y: axisMax }
    ],
    type: 'line',
    fill: false,
    borderColor: '#666',
    borderDash: [5, 5],
    pointRadius: 0,
    pointHoverRadius: 0
  });

  // Create Chart
  const ctx = document.getElementById('hitsScatterChart').getContext('2d');
  const hitsScatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Authorities z-score'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Hubs z-score'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => {
              const d = context.raw;
              return [
                `Area: ${d.label}`,
                `Authorities p-value: ${d.authoritiesP}`,
                `Hubs p-value: ${d.hubsP}`
              ];
            }
          }
        },
        legend: {
          display: true,
          labels: {
            // Optional: do not show 'y = x' line in legend
            filter: item => item.text !== 'y = x',
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      }
    }
  });
});
