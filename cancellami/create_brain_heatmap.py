# create_brain_heatmap.py
# Requires: pip install brainrender pandas openpyxl matplotlib

import re
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import cm
from brainrender import Scene
import base64
from io import BytesIO

# Files to process
input_files = [
    Path("/home/oldboy/Documents/GitHub/ECo_webapp/cancellami/fchange_heatmap_demonstrator.xlsx"),
    Path("/home/oldboy/Documents/GitHub/ECo_webapp/cancellami/fchange_heatmap_observer.xlsx")
]

# Fixed camera settings
CAMERA_POSITION = [
    (1500, 1500, 1500),  # Camera position
    (0, 0, 0),           # Target
    (0, 0, 1)            # View-up vector
]

cmap = cm.get_cmap("hot")

def generate_colormap_image():
    fig, ax = plt.subplots(figsize=(1, 5))
    norm = plt.Normalize(0, 1)
    cb = plt.colorbar(cm.ScalarMappable(norm=norm, cmap=cmap), cax=ax)
    cb.set_label("Activation", fontsize=10)
    buf = BytesIO()
    plt.savefig(buf, format="png", bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

legend_base64 = generate_colormap_image()

for file in input_files:
    fname = file.stem
    df = pd.read_excel(file)
    vals = (df.value - df.value.min()) / (df.value.max() - df.value.min())
    data = dict(zip(df.region.str.strip(), vals))

    scene = Scene(title=fname)
    scene.plotter.camera_position = CAMERA_POSITION

    for region, value in data.items():
        color = [int(255 * c) for c in cmap(value)[:3]]
        scene.add_brain_region(region, color=color, alpha=1)

    out_html = f"heatmap_{fname}.html"
    scene.export(out_html)

    html = Path(out_html).read_text()

    # Clean GUI and controls
    html = re.sub(r'new\s+dat\.GUI\([^;]*;', '', html)
    html = re.sub(r'<div[^>]*class="dg[^>]*>.*?</div>', '', html, flags=re.S)
    html = html.replace(
        '</head>',
        '<style>.dg{display:none!important}#k3d-toolbar{display:none!important}</style></head>'
    )
    html = html.replace('controls.enablePan = true', 'controls.enablePan = false')

    # Embed colorbar in bottom-right corner
    colorbar_html = (
        f'<img src="data:image/png;base64,{legend_base64}" '
        f'style="position:absolute; right:10px; bottom:10px; height:150px; '
        f'border:1px solid #ccc; background:white; padding:2px;">'
    )
    html = html.replace('</body>', f'{colorbar_html}</body>')

    Path(out_html).write_text(html)
    print(f"Widget ready: {out_html}")
