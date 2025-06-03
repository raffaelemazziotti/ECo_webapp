(async function() {
  // 1) Load data
  const [allNodes, allEdges] = await Promise.all([
    d3.json("../data/nodes.json"),
    d3.json("../data/edges.json")
  ]);

  // Shortcut refs
  const container     = d3.select("#heatmap-container");
  const containerNode = container.node();
  const tooltip       = container.select("#tooltip");

  // Constants
  const cellSize          = 12;
  const axisTitleMargin   = 20;
  const colorInterp       = d3.interpolateTurbo;      // high-contrast map
  const sci               = d3.format(".2e");

  // Draw a heatmap for the given group
  function draw(group) {
    // Clear old
    container.select("svg").remove();
    tooltip.style("opacity", 0);

    let nodes;
    // Filter nodes & build ID list
    if (group==='all'){
      nodes = allNodes.filter(n => n.group === 'observer' || n.group === 'both');
    }else{
      nodes = allNodes.filter(n => n.group === group);
    }

    const ids   = nodes.map(n => n.id);
    const n     = ids.length;

    // Build edge-weight map for this subnetwork
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
    const linScale = d3.scaleLinear([0, maxW], [0,1]);

    // Compute margins
    const leftMargin = cellSize + axisTitleMargin;
    const topMargin  = cellSize + axisTitleMargin;
    const colorbarPadding = 10;
    const colorbarWidth   = 16;
    const svgWidth  = leftMargin + n*cellSize + colorbarPadding + colorbarWidth + 50;
    const svgHeight = topMargin  + n*cellSize + 20;

    // Create SVG
    const svg = container.append("svg")
      .attr("width", svgWidth)
      .attr("height", svgHeight);

    // 2) Cells
    const grid = svg.append("g")
      .attr("transform", `translate(${leftMargin},${topMargin})`);

    d3.cross(d3.range(n), d3.range(n)).forEach(([i,j]) => {
      const key = `${ids[i]}|${ids[j]}`;
      const w   = wmap[key] || 0;
      const t   = (i === j) ? 1 : linScale(w);

      grid.append("rect")
        .attr("x",      j * cellSize)
        .attr("y",      i * cellSize)
        .attr("width",  cellSize)
        .attr("height", cellSize)
        .attr("fill",   colorInterp(t))
        .on("mouseover", (event) => {
            const [mx, my] = d3.pointer(event, containerNode);
            const scrollTop = containerNode.scrollTop;
            const scrollLeft = containerNode.scrollLeft;

            tooltip.html(`${ids[i]} → ${ids[j]}: ${sci(w)}`)
              .style("left", `${mx + scrollLeft + 10}px`)
              .style("top",  `${my + scrollTop - 10}px`)
              .style("opacity", 1);
          })
        .on("mouseout", () => {
          tooltip.style("opacity", 0);
        });
    });

    // 3) Structure-colored axes
    const structColor = Object.fromEntries(allNodes.map(n=>[n.id,n.color]));

    // Row squares
    svg.append("g")
      .attr("transform", `translate(${leftMargin - cellSize},${topMargin})`)
      .selectAll("rect")
      .data(ids)
      .join("rect")
        .attr("x",      0)
        .attr("y",      (_,i) => i * cellSize)
        .attr("width",  cellSize)
        .attr("height", cellSize)
        .attr("fill",   d => structColor[d]);

    // Column squares
    svg.append("g")
      .attr("transform", `translate(${leftMargin},${topMargin - cellSize})`)
      .selectAll("rect")
      .data(ids)
      .join("rect")
        .attr("x",      (_,i) => i * cellSize)
        .attr("y",      0)
        .attr("width",  cellSize)
        .attr("height", cellSize)
        .attr("fill",   d => structColor[d]);

    // 4) Axis titles
    svg.append("text")
      .attr("class","axis-title")
      .attr("x", leftMargin + (n*cellSize)/2)
      .attr("y", topMargin - axisTitleMargin/2)
      .attr("text-anchor","middle")
      .text("Target Region")
      .attr("dy", "-0.5em");

    svg.append("text")
      .attr("class","axis-title")
      .attr("transform",
        `translate(${leftMargin - axisTitleMargin/2 - 10},${topMargin + (n*cellSize)/2}) rotate(-90)`
      )
      .attr("text-anchor","middle")
      .text("Source Region");

    // 5) Colorbar + axis
    const barHeight = n * cellSize,
          barX      = leftMargin + n*cellSize + colorbarPadding,
          barY      = topMargin;

    // Gradient definition
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id","cb-grad")
      .attr("x1","0%").attr("y1","100%")
      .attr("x2","0%").attr("y2","0%");
    d3.range(0,1.01,0.1).forEach(t => {
      grad.append("stop")
        .attr("offset", `${t*100}%`)
        .attr("stop-color", colorInterp(t));
    });

    // Draw gradient rect
    svg.append("rect")
      .attr("x", barX)
      .attr("y", barY)
      .attr("width",  colorbarWidth)
      .attr("height", barHeight)
      .style("fill","url(#cb-grad)");

    // Colorbar axis (linear)
    const cbScale = d3.scaleLinear([0, maxW], [barY + barHeight, barY]);
    const cbAxis  = d3.axisRight(cbScale)
      .ticks(6)
      .tickFormat(sci);

    svg.append("g")
      .attr("transform", `translate(${barX + colorbarWidth + 4},0)`)
      .call(cbAxis);
  }

  // Initial draw & dropdown handler
  const select = d3.select("#group-select");
  select.on("change", () => draw(select.node().value));
  draw(select.node().value);
  d3.select("#group-select").on("change", function() {
    draw(this.value);
  });

})();
