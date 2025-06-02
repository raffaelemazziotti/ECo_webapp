import os
import json
import numpy as np
import pandas as pd
import matplotlib.colors as mcolors

from brainglobe_heatmap import Heatmap
from brainglobe_atlasapi import BrainGlobeAtlas
from shapely import Polygon
from shapely.algorithms.polylabel import polylabel
from shapely.geometry import MultiPolygon

# ────────────────────────────────────────────────────────────────────────────────
# CONFIGURATION: two “brains” (Demonstrator and Observer)
# ────────────────────────────────────────────────────────────────────────────────

EXCEL_PATH_DEMO = "fchange_heatmap_demonstrator.xlsx"
EXCEL_PATH_OBSV = "fchange_heatmap_observer.xlsx"  # example filename

N_SLICES        = 30
THICKNESS       = 100.0
SLICE_POSITIONS = np.linspace(1000.0, 10000.0, N_SLICES)
PLOTLY_RANGE    = [-5500, 5500]
HTML_OUTPUT     = "two_coronal_heatmaps2.html"

# ────────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ────────────────────────────────────────────────────────────────────────────────

def rgba_to_hex(color):
    if isinstance(color, str):
        if color.startswith("#") and len(color) in (7, 9):
            return color[:7]
        try:
            rgba = mcolors.to_rgba(color)
            return mcolors.to_hex(rgba)
        except ValueError:
            pass
    if isinstance(color, (list, tuple)) and len(color) in (3, 4):
        return mcolors.to_hex(color)
    return "#cccccc"

def build_segments_list(excel_path):
    if not os.path.isfile(excel_path):
        raise FileNotFoundError(f"Could not find '{excel_path}'.")
    df = pd.read_excel(excel_path, engine="openpyxl")
    if "region" not in df.columns or "value" not in df.columns:
        raise KeyError("Excel must have 'region' and 'value' columns.")
    df["region"] = df["region"].astype(str).str.strip()
    region_values = dict(zip(df["region"], df["value"]))
    vmin = 0.0
    vmax = float(np.ceil(df["value"].max()))
    atlas = BrainGlobeAtlas("allen_mouse_25um", check_latest=False)
    common_color_map = {}

    segments_list = []
    for idx, xpos in enumerate(SLICE_POSITIONS):
        print(f'Processing slice {idx}')
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
        segments = []
        for r_key, coords in projected.items():
            if "_segment_" not in r_key:
                continue
            name, _ = r_key.split("_segment_")
            coords2d = coords[:, :2]
            x = coords2d[:, 0]
            y = coords2d[:, 1]
            area = 0.5 * np.abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
            if not common_color_map:
                for reg, col in heatmap.colors.items():
                    common_color_map[reg] = rgba_to_hex(col)
            color_hex = common_color_map.get(name, "#cccccc")
            full_info = atlas.structures.get(name, {})
            full_name = full_info.get("name", "Unknown")
            value     = float(region_values.get(name, 0.0))
            poly_list = coords2d.tolist()
            segments.append({
                "acronym": name,
                "fullName": full_name,
                "area": round(area, 1),
                "value": round(value, 2),
                "color": color_hex,
                "polygon": poly_list,
                "isRoot": (name.lower() == "root")
            })
        segments.sort(key=lambda s: s["area"], reverse=True)
        segments_list.append(segments)
    return segments_list, vmin, vmax

segments_list_demo, vmin_demo, vmax_demo = build_segments_list(EXCEL_PATH_DEMO)
segments_list_obsv, vmin_obsv, vmax_obsv = build_segments_list(EXCEL_PATH_OBSV)

vmin = min(vmin_demo, vmin_obsv)
vmax = max(vmax_demo, vmax_obsv)

# ────────────────────────────────────────────────────────────────────────────────
# 4) WRITE OUT HTML + JS
# ────────────────────────────────────────────────────────────────────────────────

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Demonstrator & Observer Slices</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: sans-serif;
    }}
    #container {{
      display: flex;
      justify-content: center;
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
      margin-top: 20px;
      text-align: center;
    }}
    #sliceLabel {{
      font-weight: bold;
      margin-left: 8px;
    }}
    .tooltip {{
      position: absolute;
      background: rgba(0, 0, 0, 0.75);
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
    <!-- Demonstrator -->
    <div class="canvas-wrapper">
      <h3>Demonstrator</h3>
      <canvas id="canvasDemo" width="500" height="500"></canvas>
      <div id="tooltipDemo" class="tooltip"></div>
    </div>
    <!-- Observer -->
    <div class="canvas-wrapper">
      <h3>Observer</h3>
      <canvas id="canvasObsv" width="500" height="500"></canvas>
      <div id="tooltipObsv" class="tooltip"></div>
    </div>
  </div>

  <div id="controls">
    <input type="range" id="sliceSlider" min="0" max="{N_SLICES-1}" value="0" />
    <span>Slice index: <span id="sliceLabel">0</span></span>
  </div>

  <script>
    const MIN_COORD = {PLOTLY_RANGE[0]};
    const MAX_COORD = {PLOTLY_RANGE[1]};
    const CANVAS_SIZE = 500;
    const N_SLICES = {N_SLICES};
    const VMIN = {vmin};
    const VMAX = {vmax};

    const slicesDemo = {json.dumps(segments_list_demo)};
    const slicesObsv = {json.dumps(segments_list_obsv)};

    function toCanvasX(y) {{
      return ((y - MIN_COORD) / (MAX_COORD - MIN_COORD)) * CANVAS_SIZE;
    }}
    function toCanvasY(z) {{
      return ((z - MIN_COORD) / (MAX_COORD - MIN_COORD)) * CANVAS_SIZE;
    }}

    // Demonstrator canvas setup
    const canvasDemo = document.getElementById("canvasDemo");
    const ctxDemo = canvasDemo.getContext("2d");
    const tooltipDemo = document.getElementById("tooltipDemo");

    function drawSliceDemo(idx) {{
      ctxDemo.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const polys = slicesDemo[idx];
      polys.forEach(poly => {{
        ctxDemo.beginPath();
        poly.polygon.forEach((pt, i) => {{
          const x = toCanvasX(pt[0]);
          const y = toCanvasY(pt[1]);
          if (i === 0) ctxDemo.moveTo(x, y);
          else ctxDemo.lineTo(x, y);
        }});
        ctxDemo.closePath();
        ctxDemo.fillStyle = poly.color;
        ctxDemo.fill();
        ctxDemo.strokeStyle = "#000";
        ctxDemo.lineWidth = 0.5;
        ctxDemo.stroke();
      }});
    }}

    // Observer canvas setup
    const canvasObsv = document.getElementById("canvasObsv");
    const ctxObsv = canvasObsv.getContext("2d");
    const tooltipObsv = document.getElementById("tooltipObsv");

    function drawSliceObsv(idx) {{
      ctxObsv.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const polys = slicesObsv[idx];
      polys.forEach(poly => {{
        ctxObsv.beginPath();
        poly.polygon.forEach((pt, i) => {{
          const x = toCanvasX(pt[0]);
          const y = toCanvasY(pt[1]);
          if (i === 0) ctxObsv.moveTo(x, y);
          else ctxObsv.lineTo(x, y);
        }});
        ctxObsv.closePath();
        ctxObsv.fillStyle = poly.color;
        ctxObsv.fill();
        ctxObsv.strokeStyle = "#000";
        ctxObsv.lineWidth = 0.5;
        ctxObsv.stroke();
      }});
    }}

    // Initialize both canvases at slice 0
    drawSliceDemo(0);
    drawSliceObsv(0);

    // Shared slider logic
    const slider = document.getElementById("sliceSlider");
    const sliceLabel = document.getElementById("sliceLabel");
    slider.oninput = function() {{
      const idx = +this.value;
      sliceLabel.textContent = idx;
      drawSliceDemo(idx);
      drawSliceObsv(idx);
    }};

    // Tooltip for Demonstrator
    canvasDemo.addEventListener("mousemove", evt => {{
      const rect = canvasDemo.getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const my = evt.clientY - rect.top;
      const idx = +slider.value;
      const polys = slicesDemo[idx];
      let found = null;
      for (let i = 0; i < polys.length; i++) {{
        const poly = polys[i];
        if (poly.isRoot) continue;
        ctxDemo.beginPath();
        poly.polygon.forEach((pt, j) => {{
          const x = toCanvasX(pt[0]);
          const y = toCanvasY(pt[1]);
          if (j === 0) ctxDemo.moveTo(x, y);
          else ctxDemo.lineTo(x, y);
        }});
        ctxDemo.closePath();
        if (ctxDemo.isPointInPath(mx, my)) {{
          found = poly;
          break;
        }}
      }}
      if (found) {{
        tooltipDemo.style.display = "block";
        tooltipDemo.style.left = (evt.pageX + 10) + "px";
        tooltipDemo.style.top = (evt.pageY + 10) + "px";
        tooltipDemo.innerHTML =
          `<b>${{found.acronym}}</b>: ${{found.fullName}}<br>` +
          `Area: ${{found.area.toFixed(1)}} µm²<br>` +
          `Value: ${{found.value.toFixed(2)}}`;
      }} else {{
        tooltipDemo.style.display = "none";
      }}
    }});
    canvasDemo.addEventListener("mouseout", () => {{ tooltipDemo.style.display = "none"; }});

    // Tooltip for Observer
    canvasObsv.addEventListener("mousemove", evt => {{
      const rect = canvasObsv.getBoundingClientRect();
      const mx = evt.clientX - rect.left;
      const my = evt.clientY - rect.top;
      const idx = +slider.value;
      const polys = slicesObsv[idx];
      let found = null;
      for (let i = 0; i < polys.length; i++) {{
        const poly = polys[i];
        if (poly.isRoot) continue;
        ctxObsv.beginPath();
        poly.polygon.forEach((pt, j) => {{
          const x = toCanvasX(pt[0]);
          const y = toCanvasY(pt[1]);
          if (j === 0) ctxObsv.moveTo(x, y);
          else ctxObsv.lineTo(x, y);
        }});
        ctxObsv.closePath();
        if (ctxObsv.isPointInPath(mx, my)) {{
          found = poly;
          break;
        }}
      }}
      if (found) {{
        tooltipObsv.style.display = "block";
        tooltipObsv.style.left = (evt.pageX + 10) + "px";
        tooltipObsv.style.top = (evt.pageY + 10) + "px";
        tooltipObsv.innerHTML =
          `<b>${{found.acronym}}</b>: ${{found.fullName}}<br>` +
          `Area: ${{found.area.toFixed(1)}} µm²<br>` +
          `<b>Value:<b> ${{found.value.toFixed(2)}}`;
      }} else {{
        tooltipObsv.style.display = "none";
      }}
    }});
    canvasObsv.addEventListener("mouseout", () => {{ tooltipObsv.style.display = "none"; }});
  </script>
</body>
</html>
"""

with open(HTML_OUTPUT, "w") as f:
    f.write(html)

print(f"Created {HTML_OUTPUT} – open in a browser to explore both brains side by side.")
