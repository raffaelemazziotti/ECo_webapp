import os
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from io import StringIO
from brainglobe_heatmap import Heatmap
from brainglobe_atlasapi import BrainGlobeAtlas

# ─── CONFIG ─────────────────────────────────────────────────────────────────────
EXCEL_PATH_DEMO = "fchange_heatmap_demonstrator.xlsx"
EXCEL_PATH_OBSV = "fchange_heatmap_observer.xlsx"
LAYOUT = "vertical"  #  "vertical" o "horizontal"
N_SLICES = 30
THICKNESS = 100.0
SLICE_POSITIONS = np.linspace(1000.0, 10000.0, N_SLICES)
PLOTLY_RANGE = [-5500, 5500]
HTML_OUTPUT = "two_coronal_cbar"

HTML_OUTPUT = f"{HTML_OUTPUT}_{LAYOUT}.html"

# ─── HELPERS ─────────────────────────────────────────────────────────────────────
def rgba_to_hex(color):
    try:
        return mcolors.to_hex(mcolors.to_rgba(color))
    except Exception:
        return "#cccccc"

def build_segments_list(excel_path, vmin, vmax):
    df = pd.read_excel(excel_path, engine="openpyxl")
    df["region"] = df["region"].astype(str).str.strip()
    region_values = dict(zip(df["region"], df["value"]))
    atlas = BrainGlobeAtlas("allen_mouse_25um", check_latest=False)
    segments_list, common_color_map = [], {}

    for xpos in SLICE_POSITIONS:
        heatmap = Heatmap(
            region_values,
            position=float(xpos),
            orientation="frontal",
            thickness=float(THICKNESS),
            vmin=vmin,
            vmax=vmax,
            cmap="hot",
            format="array"
        )
        projected, _ = heatmap.slicer.get_structures_slice_coords(
            heatmap.regions_meshes, heatmap.scene.root
        )
        if not common_color_map:
            for reg, col in heatmap.colors.items():
                common_color_map[reg] = rgba_to_hex(col)

        slice_segments = []
        for r_key, coords in projected.items():
            if "_segment_" not in r_key:
                continue
            name, _ = r_key.split("_segment_")
            coords2d = coords[:, :2]
            x = coords2d[:, 0]
            y = coords2d[:, 1]
            area = 0.5 * np.abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
            full_name = atlas.structures.get(name, {}).get("name", "Unknown")
            slice_segments.append({
                "acronym": name,
                "fullName": full_name,
                "area": round(area, 1),
                "value": round(region_values.get(name, 0.0), 2),
                "color": common_color_map.get(name, "#cccccc"),
                "polygon": coords2d.tolist(),
                "isRoot": (name.lower() == "root")
            })
        slice_segments.sort(key=lambda s: s["area"], reverse=True)
        segments_list.append(slice_segments)

    return segments_list

def make_colorbar_svg(vmin, vmax, cmap_name="hot", width=300, height=40):
    gradient = np.linspace(vmin, vmax, 256).reshape(1, -1)
    fig, ax = plt.subplots(figsize=(width / 100, height / 100), dpi=100)
    ax.imshow(gradient, aspect='auto', cmap=cmap_name, extent=[vmin, vmax, 0, 1])
    ax.set_yticks([])
    ax.set_xticks([vmin, vmax])
    ax.set_xticklabels([f"{vmin:.1f}", f"{vmax:.1f}"])
    ax.tick_params(axis='x', bottom=False, top=False, labelbottom=True)
    ax.set_title("Fold Change", fontsize=8)
    fig.tight_layout(pad=0)
    buf = StringIO()
    fig.savefig(buf, format="svg", bbox_inches='tight')
    plt.close(fig)
    return buf.getvalue()

# ─── MAIN ────────────────────────────────────────────────────────────────────────
# Get global min and max
demo_vals = pd.read_excel(EXCEL_PATH_DEMO)["value"]
obsv_vals = pd.read_excel(EXCEL_PATH_OBSV)["value"]
vmin = 0 #float(min(demo_vals.min(), obsv_vals.min()))
vmax = float(np.ceil(max(demo_vals.max(), obsv_vals.max())))

segments_demo = build_segments_list(EXCEL_PATH_DEMO, vmin, vmax)
segments_obsv = build_segments_list(EXCEL_PATH_OBSV, vmin, vmax)
colorbar_svg = make_colorbar_svg(vmin, vmax)

# ─── HTML ────────────────────────────────────────────────────────────────────────
flex_dir = "column" if LAYOUT == "vertical" else "row"

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Coronal Slices</title>
  <style>
    html, body {{
      margin: 0;
      font-family: sans-serif;
      background: #fff;
      max-width: 100%;
      overflow-x: hidden; /* prevent horizontal scrollbar */
      overscroll-behavior: contain; /* prevent pull to refresh */
    }}
    #container {{
      display: flex;
      flex-direction: {flex_dir};
      justify-content: center;
      align-items: center;
      gap: 20px;
      margin-top: 20px;
    }}
    .canvas-wrapper {{
      text-align: center;
    }}
    canvas {{
      border: 1px solid #ccc;
      display: block;
      margin: 0 auto;
    }}
    #controls {{
      text-align: center;
      margin-top: 20px;
    }}
    .tooltip {{
      position: absolute;
      background: rgba(0,0,0,0.75);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      pointer-events: none;
      font-size: 12px;
      display: none;
      z-index: 10;
    }}
  </style>
</head>
<body>

<div id="container">
  <div class="canvas-wrapper">
    <h3>Demonstrator</h3>
    <canvas id="canvasDemo" width="500" height="500"></canvas>
    <div id="tooltipDemo" class="tooltip"></div>
  </div>
  <div class="canvas-wrapper">
    <h3>Observer</h3>
    <canvas id="canvasObsv" width="500" height="500"></canvas>
    <div id="tooltipObsv" class="tooltip"></div>
  </div>
</div>

<div id="controls">
  <input type="range" id="sliceSlider" min="0" max="{N_SLICES - 1}" value="0" />
  <span>Slice index: <strong id="sliceLabel">0</strong></span>
  <div style="margin-top: 10px;">{colorbar_svg}</div>
</div>

<script>
const MIN = {PLOTLY_RANGE[0]}, MAX = {PLOTLY_RANGE[1]}, SIZE = 500;
const slicesDemo = {json.dumps(segments_demo)};
const slicesObsv = {json.dumps(segments_obsv)};
const toX = y => ((y - MIN) / (MAX - MIN)) * SIZE;
const toY = z => ((z - MIN) / (MAX - MIN)) * SIZE;

function draw(canvasId, polys) {{
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, SIZE, SIZE);
  polys.forEach(p => {{
    ctx.beginPath();
    p.polygon.forEach(([x, y], i) => {{
      i ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y));
    }});
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }});
}}

function tooltip(canvasId, tooltipId, slices, sliderEl) {{
  const canvas = document.getElementById(canvasId);
  const tooltip = document.getElementById(tooltipId);
  canvas.addEventListener("mousemove", evt => {{
    const r = canvas.getBoundingClientRect(), x = evt.clientX - r.left, y = evt.clientY - r.top;
    const polys = slices[+sliderEl.value];
    let hit = null;
    const ctx = canvas.getContext("2d");
    for (const p of polys) {{
      if (p.isRoot) continue;
      ctx.beginPath();
      p.polygon.forEach(([px, py], i) => {{
        i ? ctx.lineTo(toX(px), toY(py)) : ctx.moveTo(toX(px), toY(py));
      }});
      ctx.closePath();
      if (ctx.isPointInPath(x, y)) {{ hit = p; break; }}
    }}
    if (hit) {{
      tooltip.style.display = "block";
      tooltip.style.left = evt.pageX + 10 + "px";
      tooltip.style.top = evt.pageY + 10 + "px";
      tooltip.innerHTML = `<b>${{hit.acronym}}</b>: ${{hit.fullName}}<br><b>Fold Change</b>: ${{hit.value}}`;
    }} else {{
      tooltip.style.display = "none";
    }}
  }});
  canvas.addEventListener("mouseout", () => tooltip.style.display = "none");
}}

window.addEventListener("DOMContentLoaded", () => {{
  const slider = document.getElementById("sliceSlider");
  const label = document.getElementById("sliceLabel");

  // Load saved index if available
  const savedIndex = localStorage.getItem("coronal_slice_index");
  if (savedIndex !== null && savedIndex >= 0 && savedIndex <= {N_SLICES - 1}) {{
    slider.value = savedIndex;
    label.textContent = savedIndex;
    draw("canvasDemo", slicesDemo[savedIndex]);
    draw("canvasObsv", slicesObsv[savedIndex]);
  }} else {{
    slider.value = 0;
    label.textContent = 0;
    draw("canvasDemo", slicesDemo[0]);
    draw("canvasObsv", slicesObsv[0]);
  }}

  // Update on slider move and save index
  slider.oninput = () => {{
    const idx = +slider.value;
    label.textContent = idx;
    draw("canvasDemo", slicesDemo[idx]);
    draw("canvasObsv", slicesObsv[idx]);
    localStorage.setItem("coronal_slice_index", idx);
  }};

  // Initialize tooltips — now pass slider explicitly!
  tooltip("canvasDemo", "tooltipDemo", slicesDemo, slider);
  tooltip("canvasObsv", "tooltipObsv", slicesObsv, slider);
}});
</script>

</body>
</html>
"""




with open(HTML_OUTPUT, "w") as f:
    f.write(html)

print(f"✔ File saved: {HTML_OUTPUT}")
