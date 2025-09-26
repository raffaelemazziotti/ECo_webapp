// connectome.js
(async function () {
  // ---- load data ----
  const [nodesRaw, edges] = await Promise.all([
    fetch("../data/nodes.json").then(r => r.json()),
    fetch("../data/edges.json").then(r => r.json())
  ]);

  // ---- elements ----
  const container = document.getElementById("graph-container");
  const wrapper = document.getElementById("graph-wrapper");
  const tip = document.getElementById("tooltip");

  Object.assign(container.style, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "calc(100vh - 200px)",
    position: "relative"
  });
  Object.assign(wrapper.style, { position: "relative", margin: "0 auto" });

  // ---- params ----
  const padding = 60;
  const baseR = 15;

  // ---- sizing ----
  function getCanvasSize() {
    const W = Math.min(1400, Math.max(320, container.clientWidth - 20));
    const H = Math.min(1000, Math.max(300, container.clientHeight - 20));
    return { W, H };
  }
  let { W, H } = getCanvasSize();

  // ---- layers ----
  let ctxEdges, ctxHighlight, ctxNodes;
  function createLayer(z) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    Object.assign(c.style, { position: "absolute", top: 0, left: 0, zIndex: String(z) });
    wrapper.appendChild(c);
    return c.getContext("2d");
  }
  function initLayers() {
    wrapper.innerHTML = "";
    ({ W, H } = getCanvasSize());
    Object.assign(wrapper.style, { width: W + "px", height: H + "px" });
    ctxEdges = createLayer(0);
    ctxHighlight = createLayer(1);
    ctxNodes = createLayer(2);
    ctxNodes.font = "12px Arial";
    ctxNodes.textAlign = "center";
    ctxNodes.textBaseline = "middle";
  }

  // ---- data prep ----
  const xs = nodesRaw.map(n => n.x), ys = nodesRaw.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  let nodes = [];
  let nodeById = {};
  const outgoing = {};
  edges.forEach(e => (outgoing[e.source] ||= []).push(e));

  function scaleNodes() {
    const scaleX = (W - 2 * padding) / (maxX - minX || 1);
    const scaleY = (H - 2 * padding) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    const usedW = (maxX - minX) * scale;
    const usedH = (maxY - minY) * scale;
    const offsetX = (W - usedW) / 2 - minX * scale;
    const offsetY = (H - usedH) / 2 - minY * scale;
    nodes = nodesRaw.map(n => ({ ...n, x: n.x * scale + offsetX, y: n.y * scale + offsetY }));
  }

  function clampToBounds(n, m = baseR + 2) {
    n.x = Math.max(padding + m, Math.min(W - padding - m, n.x));
    n.y = Math.max(padding + m, Math.min(H - padding - m, n.y));
  }

  function resolveCollisions(minDist = baseR * 2.2, iterations = 240) {
    for (let k = 0; k < iterations; k++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy; if (!d2) continue;
          const d = Math.sqrt(d2);
          if (d < minDist) {
            const push = (minDist - d) * 0.5;
            const ux = dx / d, uy = dy / d;
            a.x -= ux * push; a.y -= uy * push;
            b.x += ux * push; b.y += uy * push;
            clampToBounds(a); clampToBounds(b);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }

  function rebuildIndex() {
    nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  }

  // ---- draw ----
  function drawFaintEdges() {
    ctxEdges.clearRect(0, 0, W, H);
    ctxEdges.globalAlpha = 0.06;
    edges.forEach(e => {
      const s = nodeById[e.source], t = nodeById[e.target];
      if (!s || !t) return;
      ctxEdges.beginPath();
      ctxEdges.moveTo(s.x, s.y);
      ctxEdges.lineTo(t.x, t.y);
      ctxEdges.strokeStyle = e.color;
      ctxEdges.lineWidth = 1;
      ctxEdges.stroke();
    });
    ctxEdges.globalAlpha = 1;
  }

  function drawNodes(hoverId = null, strengths = {}) {
    ctxNodes.clearRect(0, 0, W, H);
    nodes.forEach(n => {
      let r = baseR;
      let fill = n.color;
      if (hoverId) {
        if (n.id === hoverId) r = baseR + 4;
        else if (strengths[n.id]) {
          const s = strengths[n.id];
          r = baseR + 8 * s;
          fill = hexToRgba(n.color || "#ccc", 0.3 + 0.7 * s);
        } else fill = "#fff";
      }
      ctxNodes.beginPath();
      if (n.group === "both") ctxNodes.rect(n.x - r, n.y - r, r * 2, r * 2);
      else ctxNodes.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctxNodes.fillStyle = fill; ctxNodes.fill();
      ctxNodes.lineWidth = hoverId === n.id ? 3 : 1;
      ctxNodes.strokeStyle = "#333"; ctxNodes.stroke();
      ctxNodes.fillStyle = "#000"; ctxNodes.fillText(n.id, n.x, n.y);
    });
  }

  function drawArrow(ctx, s, t, col, alpha) {
    const ang = Math.atan2(t.y - s.y, t.x - s.x);
    const len = 8;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - len * Math.cos(ang - 0.3), t.y - len * Math.sin(ang - 0.3));
    ctx.lineTo(t.x - len * Math.cos(ang + 0.3), t.y - len * Math.sin(ang + 0.3));
    ctx.closePath();
    ctx.fillStyle = hexToRgba(col, alpha);
    ctx.fill();
  }

  // ---- tooltip: relative to #graph-container ----
  function showTooltipAtMouse(html, e) {
    tip.innerHTML = html;
    tip.style.opacity = 0;
    tip.style.left = "-9999px";
    tip.style.top  = "-9999px";

    const w = tip.offsetWidth || 160;
    const h = tip.offsetHeight || 60;
    const offset = 12;

    const dirs = [
      [ offset,  0], [-offset - w, 0],
      [ 0,  offset], [ 0, -offset - h]
    ];
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];

    // position relative to container
    const cRect = container.getBoundingClientRect();
    let tx = (e.pageX - cRect.left) + dx;
    let ty = (e.pageY - cRect.top)  + dy;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (tx + w > cw - 2) tx = cw - w - 2;
    if (ty + h > ch - 2) ty = ch - h - 2;
    if (tx < 2) tx = 2;
    if (ty < 2) ty = 2;

    tip.style.left = `${tx}px`;
    tip.style.top  = `${ty}px`;
    tip.style.opacity = 1;
  }
  function hideTooltip() { tip.style.opacity = 0; }

  // ---- interaction ----
  let lastHover = null;
  wrapper.addEventListener("mousemove", e => {
    const rect = wrapper.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hover = null;
    for (const n of nodes) {
      const r = baseR + 3;
      if ((n.x - mx) ** 2 + (n.y - my) ** 2 <= r * r) { hover = n; break; }
    }

    ctxHighlight.clearRect(0, 0, W, H);

    if (hover) {
      if (hover.id !== lastHover) {
        ctxEdges.clearRect(0, 0, W, H);

        const outs = outgoing[hover.id] || [];
        const strengths = {};
        if (outs.length) {
          const weights = outs.map(e => e.weight || 0);
          const minW = Math.min(...weights);
          const maxW = Math.max(...weights);
          const range = maxW - minW || 1;

          outs.forEach(e2 => {
            const s = nodeById[e2.source], t = nodeById[e2.target];
            if (!s || !t) return;
            const norm = (e2.weight - minW) / range;
            ctxHighlight.beginPath();
            ctxHighlight.moveTo(s.x, s.y);
            ctxHighlight.lineTo(t.x, t.y);
            ctxHighlight.strokeStyle = hexToRgba(e2.color, norm);
            ctxHighlight.lineWidth = 2;
            ctxHighlight.stroke();
            drawArrow(ctxHighlight, s, t, e2.color, norm);
            strengths[t.id] = Math.max(strengths[t.id] || 0, norm);
          });
        }

        drawNodes(hover.id, strengths);
        const html = `${hover.id}<br><b>${hover.name}</b><br>${hover.structure}`;
        showTooltipAtMouse(html, e);
      }
    } else {
      drawFaintEdges();
      drawNodes();
      hideTooltip();
    }

    lastHover = hover?.id || null;
  });

  wrapper.addEventListener("mouseleave", () => {
    ctxHighlight.clearRect(0, 0, W, H);
    drawFaintEdges();
    drawNodes();
    hideTooltip();
    lastHover = null;
  });

  // ---- build ----
  function rebuildAll() {
    initLayers();
    scaleNodes();
    resolveCollisions(baseR * 2.2, 260);
    rebuildIndex();
    drawFaintEdges();
    drawNodes();
    hideTooltip();
  }
  window.addEventListener("resize", rebuildAll);

  // ---- start ----
  rebuildAll();

  // ---- utils ----
  function hexToRgba(hex, alpha) {
    let h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const int = parseInt(h || "cccccc", 16);
    const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
})();
