import pandas as pd
import numpy as np
import plotly.graph_objs as go
from brainglobe_heatmap import Heatmap
import matplotlib.pyplot as plt

# Load and normalize activation data
df = pd.read_excel("fchange_heatmap_demonstrator.xlsx")
vals = (df.value - df.value.min()) / (df.value.max() - df.value.min())
region_values = dict(zip(df.region.str.strip(), vals))

# Prepare slices
positions = np.linspace(4000, 8000, 10)
slices = []
labels = []

for pos in positions:
    heatmap = Heatmap(
        region_values,
        position=pos,
        orientation="frontal",
        thickness=400,
        vmin=0,
        vmax=1,
        cmap="hot",
        format="array"
    )

    # Z-values (intensity map)
    z = np.ma.filled(heatmap.values, fill_value=np.nan)

    # Build hover text by mapping label regions to acronyms
    label_id_map = heatmap.label_regions
    text = np.empty_like(label_id_map, dtype=object)

    for label_id, acronym in heatmap.label_id_to_acronym.items():
        text[label_id_map == label_id] = acronym

    slices.append(z)
    labels.append(text)

# Create interactive Plotly figure
frames = [
    go.Frame(
        data=go.Heatmap(
            z=slices[i],
            text=labels[i],
            hoverinfo="text+z",
            colorscale="Hot",
            zmin=0,
            zmax=1,
            colorbar=dict(title="Activation")
        ),
        name=f"Slice {i}"
    )
    for i in range(len(slices))
]

fig = go.Figure(
    data=go.Heatmap(
        z=slices[0],
        text=labels[0],
        hoverinfo="text+z",
        colorscale="Hot",
        zmin=0,
        zmax=1,
        colorbar=dict(title="Activation")
    ),
    frames=frames
)

fig.update_layout(
    title="Interactive Coronal Heatmap Slices",
    updatemenus=[
        dict(type="buttons", showactive=False,
             buttons=[dict(label="Play", method="animate", args=[None])])
    ],
    sliders=[
        dict(
            steps=[dict(method="animate", args=[[f"Slice {i}"]], label=f"{int(pos)} µm")
                   for i, pos in enumerate(positions)],
            active=0,
            x=0.1,
            xanchor="left",
            y=0,
            yanchor="top"
        )
    ]
)

fig.write_html("interactive_coronal_heatmap.html")
fig.show()
