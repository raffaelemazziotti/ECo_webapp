# make_heatmap_widget.py
# deps: pip install brainrender pandas openpyxl matplotlib

import re
from pathlib import Path
import pandas as pd
from matplotlib import cm
from brainrender import Scene

df = pd.read_excel("activations.xlsx")           # region | value
vals = (df.value - df.value.min()) / (df.value.max() - df.value.min())
data = dict(zip(df.region.str.strip(), vals))

scene = Scene()
cmap  = cm.get_cmap("hot")
for r, v in data.items():
    scene.add_brain_region(r, color=[int(255*c) for c in cmap(v)[:3]], alpha=1)

out_html = "mouse_heatmap.html"
scene.export(out_html)

html = Path(out_html).read_text()

# remove dat.GUI panel
html = re.sub(r'new\s+dat\.GUI\([^;]*;', '', html)
html = re.sub(r'<div[^>]*class="dg[^>]*>.*?</div>', '', html, flags=re.S)

# hide any remaining toolbars
html = html.replace(
    '</head>',
    '<style>.dg{display:none!important}#k3d-toolbar{display:none!important}</style></head>'
)

# disable panning
html = html.replace('controls.enablePan = true', 'controls.enablePan = false')

Path(out_html).write_text(html)
print("widget ready:", out_html)
