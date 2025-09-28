// connectome.js
(async function () {
  const [nodesRaw, edges] = await Promise.all([
    fetch("../data/nodes.json").then(r => r.json()),
    fetch("../data/edges.json").then(r => r.json())
  ]);

  const container = document.getElementById("graph-container");
  const wrapper   = document.getElementById("graph-wrapper");
  const infoBox   = document.getElementById("node-info");
  const edgeModeSelect = document.getElementById("edge-mode");

  // ---- sizing ----
  const padding = 40;
  function getBaseR() {
    const w = window.innerWidth;
    if (w <= 420) return 6;
    if (w <= 768) return 10;
    return 15;
  }
  let baseR = getBaseR();

  function getCanvasSize() {
    const W = container.clientWidth;
    const H = container.clientHeight;
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
    Object.assign(wrapper.style, { width: `${W}px`, height: `${H}px` });
    ctxEdges     = createLayer(0);
    ctxHighlight = createLayer(1);
    ctxNodes     = createLayer(2);

    const fs = Math.max(10, Math.round(baseR * 0.9));
    ctxNodes.font = `${fs}px Arial`;
    ctxNodes.textAlign = "center";
    ctxNodes.textBaseline = "middle";
  }

  // ---- scaling ----
  const xs = nodesRaw.map(n => n.x), ys = nodesRaw.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  let nodes = [], nodeById = {};
  const outgoing = {};
  const incoming = {};
  edges.forEach(e => {
    (outgoing[e.source] ||= []).push(e);
    (incoming[e.target] ||= []).push(e);
  });

  function scaleNodes() {
    const { W, H } = getCanvasSize();
    const scaleX = (W - 2 * padding) / (maxX - minX || 1);
    const scaleY = (H - 2 * padding) / (maxY - minY || 1);
    const scale  = Math.min(scaleX, scaleY);

    const usedW  = (maxX - minX) * scale;
    const usedH  = (maxY - minY) * scale;
    const offsetX = (W - usedW) / 2 - minX * scale;
    const offsetY = (H - usedH) / 2 - minY * scale;

    nodes = nodesRaw.map(n => ({
      ...n,
      x: n.x * scale + offsetX,
      y: n.y * scale + offsetY
    }));
  }

  function rebuildIndex() {
    nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  }

  // ---- drawing ----
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

    const isMobile = window.innerWidth <= 768;

    nodes.forEach(n => {
      let r = baseR;
      let fill = n.color;

      if (hoverId) {
        if (n.id === hoverId) {
          r = baseR + 4;
        } else if (strengths[n.id]) {
          const s = strengths[n.id];
          r = baseR + 8 * s;
          fill = hexToRgba(n.color || "#ccc", 0.3 + 0.7 * s);
        } else {
          fill = "#fff";
        }
      }

      ctxNodes.beginPath();
      if (n.group === "both") ctxNodes.rect(n.x - r, n.y - r, r * 2, r * 2);
      else ctxNodes.arc(n.x, n.y, r, 0, Math.PI * 2);

      ctxNodes.fillStyle = fill;
      ctxNodes.fill();

      if (hoverId === n.id) {
        ctxNodes.lineWidth = 3;
        ctxNodes.strokeStyle = "#333";
        ctxNodes.stroke();
      } else if (!isMobile) {
        ctxNodes.lineWidth = 1;
        ctxNodes.strokeStyle = "#333";
        ctxNodes.stroke();
      } else {
        // mobile: transparent border for unselected nodes
        ctxNodes.strokeStyle = "rgba(0,0,0,0)";
        ctxNodes.stroke();
      }

      ctxNodes.fillStyle = "#000";
      ctxNodes.fillText(n.id, n.x, n.y);
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

  // ---- info panel ----
  function showNodeInfo(n) {
    infoBox.innerHTML = `<b>${n.id}</b><br>${n.name}<br><b>${n.structure}</b>`;
  }
  function clearNodeInfo() {
    infoBox.innerHTML = "Hover a node to see details";
  }

  // ---- interaction ----
  let lastHover = null;
  wrapper.addEventListener("mousemove", e => {
    const rect = wrapper.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hover = null;
    for (const n of nodes) {
      if ((n.x - mx) ** 2 + (n.y - my) ** 2 < (baseR + 2) ** 2) { hover = n; break; }
    }
    if (hover?.id === lastHover) return;

    ctxHighlight.clearRect(0, 0, W, H);

    if (hover) {
      ctxEdges.clearRect(0, 0, W, H);

      const mode = edgeModeSelect.value;
      const list = mode === "outgoing" ? (outgoing[hover.id] || []) : (incoming[hover.id] || []);
      const strengths = {};

      if (list.length) {
        const weights = list.map(e => e.weight || 0);
        const minW = Math.min(...weights);
        const maxW = Math.max(...weights);
        const range = maxW - minW || 1;

        list.forEach(e2 => {
          const s = nodeById[e2.source], t = nodeById[e2.target];
          if (!s || !t) return;
          const norm = (e2.weight - minW) / range;

          ctxEdges.beginPath();
          ctxEdges.moveTo(s.x, s.y);
          ctxEdges.lineTo(t.x, t.y);

          if (mode === "outgoing") {
            ctxEdges.strokeStyle = hexToRgba(hover.color, norm);
          } else {
            ctxEdges.strokeStyle = hexToRgba(s.color, norm);
          }

          ctxEdges.lineWidth = 2;
          ctxEdges.stroke();

          const arrowColor = (mode === "outgoing") ? hover.color : s.color;
          drawArrow(ctxEdges, s, t, arrowColor, norm);

          const targetId = mode === "outgoing" ? t.id : s.id;
          strengths[targetId] = Math.max(strengths[targetId] || 0, norm);
        });
      }

      drawNodes(hover.id, strengths);
      showNodeInfo(hover);
    } else {
      drawFaintEdges();
      drawNodes();
      clearNodeInfo();
    }
    lastHover = hover?.id || null;
  });

  wrapper.addEventListener("mouseleave", () => {
    ctxHighlight.clearRect(0, 0, W, H);
    drawFaintEdges();
    drawNodes();
    clearNodeInfo();
    lastHover = null;
  });

  // ---- rebuild ----
  function rebuildAll() {
    baseR = getBaseR();
    initLayers();
    scaleNodes();
    rebuildIndex();
    drawFaintEdges();
    drawNodes();
    clearNodeInfo();
  }
  window.addEventListener("resize", rebuildAll);
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
