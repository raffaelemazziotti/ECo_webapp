(async function() {
  // Load data
  const [allNodes, allEdges] = await Promise.all([
    d3.json("../data/nodes.json"),
    d3.json("../data/edges.json")
  ]);

  const container     = d3.select("#heatmap-container");
  const containerNode = container.node();
  const tooltip       = container.select("#tooltip");

  const colorInterp   = d3.interpolateTurbo;
  const sci           = d3.format(".2e");

  // Quick lookup for node metadata
  const nodeById = Object.fromEntries(allNodes.map(n => [n.id, n]));

  function draw(group) {
    container.select("svg").remove();
    tooltip.style("opacity", 0);

    // Filter nodes
    let nodes;
    if (group === "all") {
      nodes = allNodes.filter(n => n.group === "observer" || n.group === "both");
    } else {
      nodes = allNodes.filter(n => n.group === group);
    }

    const ids = nodes.map(n => n.id);
    const n   = ids.length;

    // Build edge weight map
    const idSet = new Set(ids);
    const wmap  = {};
    allEdges.forEach(e => {
      if (idSet.has(e.source) && idSet.has(e.target)) {
        const w = +e.weight;
        if (w > 0) wmap[`${e.source}|${e.target}`] = w;
      }
    });
    const weights = Object.values(wmap);
    const maxW    = weights.length ? d3.max(weights) : 1;
    const linScale = d3.scaleLinear([0, maxW], [0, 1]);

    // Responsive sizing
    const availW = containerNode.clientWidth;
    const availH = containerNode.clientHeight;

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };

    const cellSize = Math.min(
      (availW - margin.left - margin.right) / n,
      (availH - margin.top - margin.bottom) / n
    );

    const gridWidth  = n * cellSize;
    const gridHeight = n * cellSize;
    const svgWidth   = margin.left + gridWidth + margin.right;
    const svgHeight  = margin.top + gridHeight + margin.bottom;

    const svg = container.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    // === Heatmap cells ===
    const grid = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.cross(d3.range(n), d3.range(n)).forEach(([i, j]) => {
      const key = `${ids[i]}|${ids[j]}`;
      const w   = wmap[key] || 0;
      const t   = (i === j) ? 1 : linScale(w);

      grid.append("rect")
        .attr("x", j * cellSize)
        .attr("y", i * cellSize)
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", colorInterp(t))
        .on("mousemove touchmove", (event) => {
          const [mx, my] = d3.pointer(event, containerNode);
          const n1 = nodeById[ids[i]];
          const n2 = nodeById[ids[j]];

          tooltip.html(`
            <strong>${ids[i]} → ${ids[j]}</strong><br/>
            ${n1.structure} → ${n2.structure}<br/>
            ${n1.name}<br/>
            ${n2.name}
          `)
            .style("left", `${mx + 10}px`)
            .style("top",  `${my - 10}px`)
            .style("opacity", 1);
        })
        .on("mouseout touchend", () => tooltip.style("opacity", 0));
    });

    // === Axis color squares ===
    const structColor = Object.fromEntries(allNodes.map(n => [n.id, n.color]));

    svg.append("g")
      .attr("transform", `translate(${margin.left - cellSize},${margin.top})`)
      .selectAll("rect")
      .data(ids)
      .join("rect")
        .attr("y", (_, i) => i * cellSize)
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", d => structColor[d]);

    svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top - cellSize})`)
      .selectAll("rect")
      .data(ids)
      .join("rect")
        .attr("x", (_, i) => i * cellSize)
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", d => structColor[d]);

    // === Axis titles (adaptive) ===
    const labelFont = Math.max(10, cellSize * 0.7);

    svg.append("text")
      .attr("class", "axis-title")
      .attr("x", margin.left + gridWidth / 2)
      .attr("y", margin.top - cellSize - 8)
      .attr("text-anchor", "middle")
      .style("font-size", `${labelFont}px`)
      .text("Target Region");

    svg.append("text")
      .attr("class", "axis-title")
      .attr("transform",
        `translate(${margin.left - cellSize - 20},${margin.top + gridHeight / 2}) rotate(-90)`
      )
      .attr("text-anchor", "middle")
      .style("font-size", `${labelFont}px`)
      .text("Source Region");

    // === Colorbar ===
    const barHeight = gridHeight;
    const barX = margin.left + gridWidth + 25;
    const barY = margin.top;
    const barW = 16;

    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id", "cb-grad")
      .attr("x1", "0%").attr("y1", "100%")
      .attr("x2", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach(t => {
      grad.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorInterp(t));
    });

    svg.append("rect")
      .attr("x", barX)
      .attr("y", barY)
      .attr("width", barW)
      .attr("height", barHeight)
      .style("fill", "url(#cb-grad)");

    const cbScale = d3.scaleLinear([0, maxW], [barY + barHeight, barY]);
    const cbAxis  = d3.axisRight(cbScale).ticks(5).tickFormat(sci);

    svg.append("g")
      .attr("transform", `translate(${barX + barW + 4},0)`)
      .call(cbAxis);
  }

  // Dropdown handling
  const select = d3.select("#group-select");
  select.on("change", () => draw(select.node().value));
  draw(select.node().value);
})();
