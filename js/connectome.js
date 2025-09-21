// connectome.js
(async function () {
  const [nodesData, edgesData] = await Promise.all([
    fetch("../data/nodes.json").then(r => r.json()),
    fetch("../data/edges.json").then(r => r.json())
  ]);

  const nodes = nodesData.map(n => ({ ...n }));
  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  const outgoing = {};
  edgesData.forEach(e => {
    (outgoing[e.source] ||= []).push(e);
  });

  const wrapper = document.getElementById("graph-wrapper");
  const W = 1300, H = 1000;
  wrapper.style.width = W + "px";
  wrapper.style.height = H + "px";

  function createLayer(z) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.style.position = "absolute";
    c.style.top = "0";
    c.style.left = "0";
    c.style.zIndex = z;
    wrapper.appendChild(c);
    return c.getContext("2d");
  }

  const ctxEdges = createLayer(0);
  const ctxHighlight = createLayer(1);
  const ctxNodes = createLayer(2);

  // --- Background: faint edges, all same style ---
  ctxEdges.globalAlpha = 0.05;
  edgesData.forEach(e => {
    const s = nodeById[e.source], t = nodeById[e.target];
    ctxEdges.beginPath();
    ctxEdges.moveTo(s.x, s.y);
    ctxEdges.lineTo(t.x, t.y);
    ctxEdges.strokeStyle = e.color;
    ctxEdges.lineWidth = 1;
    ctxEdges.stroke();
  });
  ctxEdges.globalAlpha = 1;

  ctxNodes.font = "12px Arial";
  ctxNodes.textAlign = "center";
  ctxNodes.textBaseline = "middle";

  function drawNodes(hoverId = null) {
    ctxNodes.clearRect(0, 0, W, H);
    const r = 15;
    nodes.forEach(n => {
      ctxNodes.beginPath();
      if (n.group === "both") {
        ctxNodes.rect(n.x - r, n.y - r, r * 2, r * 2);
      } else {
        ctxNodes.arc(n.x, n.y, r, 0, Math.PI * 2);
      }
      ctxNodes.fillStyle = n.color || "#ccc";
      ctxNodes.fill();
      ctxNodes.lineWidth = (n.id === hoverId ? 3 : 1);
      ctxNodes.strokeStyle = "#333";
      ctxNodes.stroke();
      ctxNodes.fillStyle = "#000";
      ctxNodes.fillText(n.id, n.x, n.y);
    });
  }

  drawNodes();

  const legend = document.getElementById("legend");
  const structMap = {};
  nodes.forEach(n => structMap[n.structure] = n.color);
  Object.entries(structMap).forEach(([label, color]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="swatch" style="background:${color}"></div>
      <div>${label}</div>`;
    legend.appendChild(div);
  });

  const tip = document.getElementById("tooltip");
  function showTooltip(x, y, html) {
  tip.innerHTML = html;
  const offset = 15;
  let tx = x + offset;
  let ty = y + offset;

  const r = 20; // node radius + padding
  let overlap = true;
  let attempts = 0;

  // try up to 4 positions (right-down, left-down, right-up, left-up)
  const candidates = [
    { dx: offset, dy: offset },
    { dx: -offset - tip.offsetWidth, dy: offset },
    { dx: offset, dy: -offset - tip.offsetHeight },
    { dx: -offset - tip.offsetWidth, dy: -offset - tip.offsetHeight }
  ];

  for (const cand of candidates) {
    tx = x + cand.dx;
    ty = y + cand.dy;

    overlap = nodes.some(n => {
      const dx = n.x - tx;
      const dy = n.y - ty;
      return Math.sqrt(dx * dx + dy * dy) < r;
    });

    if (!overlap) break;
    attempts++;
  }

  tip.style.left = `${tx}px`;
  tip.style.top = `${ty}px`;
  tip.style.opacity = 1;
}
  function hideTooltip() {
    tip.style.opacity = 0;
  }

  function drawArrow(ctx, s, t, col, alpha) {
    const angle = Math.atan2(t.y - s.y, t.x - s.x);
    const len = 8;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - len * Math.cos(angle - 0.3), t.y - len * Math.sin(angle - 0.3));
    ctx.lineTo(t.x - len * Math.cos(angle + 0.3), t.y - len * Math.sin(angle + 0.3));
    ctx.closePath();
    ctx.fillStyle = hexToRgba(col, alpha);
    ctx.fill();
  }

  let lastHover = null;

  wrapper.addEventListener("mousemove", evt => {
    const rect = wrapper.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;

    let hovered = null;
    for (const n of nodes) {
      if ((n.x - mx) ** 2 + (n.y - my) ** 2 < 100) {
        hovered = n;
        break;
      }
    }

    if (hovered?.id === lastHover) return;

    ctxHighlight.clearRect(0, 0, W, H);

    if (hovered) {
      drawNodes(hovered.id);
      showTooltip(mx, my, `${hovered.id}<br><b>${hovered.name}</b><br>${hovered.structure}`);

      const outs = outgoing[hovered.id] || [];
    if (outs.length > 0) {
      const wVals = outs.map(e => e.weight || 0);
      const minW = Math.min(...wVals);
      const maxW = Math.max(...wVals);
      const range = maxW - minW || 1;

      outs.forEach(e => {
        const s = nodeById[e.source], t = nodeById[e.target];
        const norm = (e.weight - minW) / range; // 0 → weakest, 1 → strongest
        const alpha = norm; // direct map: 0..1
        ctxHighlight.beginPath();
        ctxHighlight.moveTo(s.x, s.y);
        ctxHighlight.lineTo(t.x, t.y);
        ctxHighlight.strokeStyle = hexToRgba(e.color, alpha);
        ctxHighlight.lineWidth = 2;
        ctxHighlight.stroke();
        drawArrow(ctxHighlight, s, t, e.color, alpha);
      });
    }
    } else {
      drawNodes();
      hideTooltip();
    }

    lastHover = hovered?.id || null;
  });

  wrapper.addEventListener("mouseleave", () => {
    ctxHighlight.clearRect(0, 0, W, H);
    drawNodes();
    hideTooltip();
    lastHover = null;
  });

  // helper: convert hex color to rgba string with alpha
  function hexToRgba(hex, alpha) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const int = parseInt(h, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

})();
