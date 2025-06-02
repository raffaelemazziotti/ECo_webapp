(async function(){
  // 1) Load data
  const [nodesData, edgesData] = await Promise.all([
    fetch("../data/nodes.json").then(r=>r.json()),
    fetch("../data/edges.json").then(r=>r.json())
  ]);

  // 2) Prepare lookups
  const nodes = nodesData.map(n => ({ ...n }));
  const nodeById = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const outgoing = {};
  edgesData.forEach(e => {
    (outgoing[e.source] ||= []).push(e);
  });

  // 3) Create canvases
  const container = document.getElementById("graph-wrapper");
  const W = container.clientWidth, H = container.clientHeight;

  function makeCtx(z){
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.style.position = "absolute";
    c.style.top = "0"; c.style.left = "0";
    c.style.zIndex = z;
    container.appendChild(c);
    return c.getContext("2d");
  }
  const ctxEdges     = makeCtx(0);
  const ctxHighlight = makeCtx(1);
  const ctxNodes     = makeCtx(2);

  // 4) Draw all edges as faint lines
  ctxEdges.lineCap = "round";
  ctxEdges.globalAlpha = 0.15;
  edgesData.forEach(e => {
    const s = nodeById[e.source], t = nodeById[e.target];
    ctxEdges.beginPath();
    ctxEdges.moveTo(s.x, s.y);
    ctxEdges.lineTo(t.x, t.y);
    ctxEdges.strokeStyle = e.color;
    ctxEdges.lineWidth   = 1.2;
    ctxEdges.stroke();
  });
  ctxEdges.globalAlpha = 1;

  // 5) Node‐drawing settings: font + alignment
  ctxNodes.font         = "12px Arial";
  ctxNodes.textAlign    = "center";
  ctxNodes.textBaseline = "middle";

  // 6) Draw all nodes, with optional hover‐highlight
  function drawAllNodes(hoverId = null) {
    ctxNodes.clearRect(0, 0, W, H);
    const s = 15;  // half‐size for shape
    nodes.forEach(n => {
      ctxNodes.beginPath();
      if (n.group === "both") {
        // square
        ctxNodes.rect(n.x - s, n.y - s, s * 2, s * 2);
      } else {
        // circle
        ctxNodes.arc(n.x, n.y, s, 0, Math.PI * 2);
      }
      // fill + border
      ctxNodes.fillStyle = n.color || "#ccc";
      ctxNodes.fill();
      ctxNodes.lineWidth   = (n.id === hoverId ? 3 : 1);
      ctxNodes.strokeStyle = "#333";
      ctxNodes.stroke();

      // label (acronym)
      ctxNodes.fillStyle = "#000";
      ctxNodes.fillText(n.id, n.x, n.y);
    });
  }
  drawAllNodes();

  // 7) Legend
  const legend = document.getElementById("legend");
  const structMap = {};
  nodes.forEach(n => structMap[n.structure] = n.color);
  Object.entries(structMap).forEach(([str,col]) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="swatch" style="background:${col}"></div>
      <div>${str}</div>`;
    legend.appendChild(item);
  });

  // 8) Tooltip helpers
  const tip = document.getElementById("tooltip");
  function showTip(x,y,html){
    tip.innerHTML = html;
    tip.style.left = x + "px";
    tip.style.top  = y + "px";
    tip.style.opacity = 1;
  }
  function hideTip(){
    tip.style.opacity = 0;
  }

  // 9) Arrow‐drawing helper
  function drawArrow(ctx, s, t, col){
    const ang = Math.atan2(t.y - s.y, t.x - s.x);
    const L   = 8;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - L * Math.cos(ang - 0.3), t.y - L * Math.sin(ang - 0.3));
    ctx.lineTo(t.x - L * Math.cos(ang + 0.3), t.y - L * Math.sin(ang + 0.3));
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }

  // 10) Hit‐testing & hover logic
  let prevHover = null;
  container.addEventListener("mousemove", evt => {
    const r = container.getBoundingClientRect();
    const mx = evt.clientX - r.left;
    const my = evt.clientY - r.top;

    // find node under cursor (radius s=10)
    let hit = null;
    for (const n of nodes) {
      if ((n.x - mx) ** 2 + (n.y - my) ** 2 < 10*10) {
        hit = n;
        break;
      }
    }

    if ((hit && hit.id) === prevHover) return;

    ctxHighlight.clearRect(0, 0, W, H);

    if (hit) {
      drawAllNodes(hit.id);
      showTip(
      evt.offsetX + 0,
      evt.offsetY - 70,
      `${hit.id}<br><b>${hit.name}</b><br>${hit.structure}`
    );

      // draw outgoing edges with arrows
      (outgoing[hit.id]||[]).forEach(e => {
        const s = nodeById[e.source], t = nodeById[e.target];
        ctxHighlight.beginPath();
        ctxHighlight.moveTo(s.x, s.y);
        ctxHighlight.lineTo(t.x, t.y);
        ctxHighlight.strokeStyle = e.color;
        ctxHighlight.lineWidth   = 2;
        ctxHighlight.stroke();
        drawArrow(ctxHighlight, s, t, e.color);
      });
    } else {
      drawAllNodes();
      hideTip();
    }

    prevHover = hit && hit.id;
  });

  // 11) Clear on leave
  container.addEventListener("mouseleave", () => {
    ctxHighlight.clearRect(0,0,W,H);
    drawAllNodes();
    hideTip();
    prevHover = null;
  });

})();



