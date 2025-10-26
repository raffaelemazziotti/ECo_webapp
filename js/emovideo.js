(async function() {
  // ---------- Load and parse time series ----------
  const tsRaw = await d3.csv("../data/mod_vis_resp_ts.csv");
  const ts = tsRaw.map(d => {
    const t = +d[tsRaw.columns[0]];
    return {
      time: Math.round(t * 100) / 100, // 2 decimals
      up: +d.up,
      in: +d.in,
      ps: +d.ps
    };
  });

  console.log("Time series parsed:", ts.slice(0, 5));

  // ---------- Time series chart (linear axis) ----------
  const datasetsTS = [
    {
      label: "UP",
      data: ts.map(d => ({ x: d.time, y: d.up })),
      borderColor: "#1f77b4",
      fill: false,
      pointRadius: 0
    },
    {
      label: "IN",
      data: ts.map(d => ({ x: d.time, y: d.in })),
      borderColor: "#ff7f0e",
      fill: false,
      pointRadius: 0
    },
    {
      label: "PS",
      data: ts.map(d => ({ x: d.time, y: d.ps })),
      borderColor: "#2ca02c",
      fill: false,
      pointRadius: 0
    }
  ];

  const ctx1 = document.getElementById("timeseries-chart").getContext("2d");
  new Chart(ctx1, {
    type: "line",
    data: { datasets: datasetsTS },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 10 } }
        }
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Time (s)" },
          min: ts[0].time,
          max: ts[ts.length - 1].time,
          ticks: {
            stepSize: 0.95, // adjust step size as needed
            callback: (val) => val.toFixed(2)
          }
        },
        y: { title: { display: true, text: "Pupil Size" } }
      }
    }
  });

  // ---------- Load and parse peaks ----------
  const pkRaw = await d3.csv("../data/mod_vis_resp_pk.csv");
  //console.log("PK raw columns:", pkRaw.columns);
  //console.log("PK raw first rows:", pkRaw.slice(0, 5));

  const valueCol = pkRaw.columns.find(c => c.trim().toLowerCase() === "val");

  function normalizeCond(c) {
    const x = c.trim().toLowerCase();
    if (x === "inv" || x === "inverted") return "IN";
    if (x === "upright" || x === "up") return "UP";
    if (x === "ps" || x.includes("scram")) return "PS";
    return x;
  }

  const pk = pkRaw.map(d => ({
    sub: +d.sub,
    cond: normalizeCond(d.cond),
    value: parseFloat(String(d[valueCol]).trim().replace(",", "."))
  }));

  //console.log("Peaks parsed:", pk.slice(0, 5));

  // ---------- Peak responses scatter plot ----------
  const colors = { UP: "#1f77b4", IN: "#ff7f0e", PS: "#2ca02c" };
  const grouped = d3.group(pk.filter(d => !isNaN(d.value)), d => d.cond);
  const conditions = Array.from(grouped.keys());

  const datasets = [];
  for (const cond of conditions) {
    const arr = grouped.get(cond) || [];
    const mean = d3.mean(arr, d => d.value);
    const color = colors[cond] || "#888";

    // individuals
    datasets.push({
      label: cond,
      data: arr.map(d => ({ x: cond, y: d.value })),
      pointBackgroundColor: `rgba(${hexToRgb(color)},0.4)`,
      pointBorderColor: color,
      pointRadius: 5
    });

    // mean
    datasets.push({
      label: cond + " mean",
      data: [{ x: cond, y: mean }],
      pointBackgroundColor: color,
      pointBorderColor: "#000",
      pointRadius: 10
    });
  }

  const ctx2 = document.getElementById("peaks-chart").getContext("2d");
  new Chart(ctx2, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
  x: {
    type: "category",
    labels: conditions,
    offset: true,          // adds half-category spacing on both ends
    title: { display: true, text: "Condition" }
  },
  y: {
    title: { display: true, text: "Pupil Size" }
  }
}
    }
  });

  // ---------- helper ----------
  function hexToRgb(hex) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
  }
})();
