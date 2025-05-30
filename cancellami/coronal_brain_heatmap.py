"""
pip install pandas openpyxl requests simpleitk nibabel tqdm
"""
import requests, pandas as pd, numpy as np, SimpleITK as sitk, nibabel as nib
from pathlib import Path
from tqdm import tqdm

# ----- configuration -------------------------------------------------
EXCEL_FILE   = "activations.xlsx"        # region | value
RES          = 25                        # 25 µm template keeps size small
ANN_NRRD     = f"annotation_{RES}.nrrd"
TEMPLATE_NRRD= f"average_template_{RES}.nrrd"

# ----- 1. download Allen files if missing ----------------------------
BASE = ("https://download.alleninstitute.org/informatics-archive/"
        "current-release/mouse_ccf")
files = {ANN_NRRD: f"{BASE}/annotation/ccf_2017/{ANN_NRRD}",
         TEMPLATE_NRRD: f"{BASE}/average_template/{TEMPLATE_NRRD}"}
for name, url in files.items():
    if not Path(name).exists():
        print("↓", name)
        r = requests.get(url, stream=True); r.raise_for_status()
        with open(name, "wb") as f:
            for chunk in r.iter_content(2**20):
                f.write(chunk)

# ----- 2. map acronym → structure ID --------------------------------
graph = requests.get("http://api.brain-map.org/api/v2/structure_graph_download/1.json").json()
SID = {}
def walk(n): SID[n["acronym"]] = n["id"]; [walk(c) for c in n.get("children",[])]
walk(graph["msg"][0])

# ----- 3. read Excel, normalise values 0–1 ---------------------------
df   = pd.read_excel(EXCEL_FILE)         # region | value
vals = (df.value - df.value.min()) / (df.value.max() - df.value.min())
act  = dict(zip(df.region.str.strip(), vals))

# ----- 4. paint voxel heat-volume -----------------------------------
ann_img = sitk.ReadImage(ANN_NRRD)
ann     = sitk.GetArrayFromImage(ann_img)          # z,y,x
heat    = np.zeros_like(ann, np.float32)
for acr, v in act.items():
    sid = SID.get(acr)
    if sid is None:
        print("⚠ unknown acronym:", acr)
    else:
        heat[ann == sid] = v

# ----- 5. write NIfTI files (atlas + heat) ---------------------------
def save(nrrd, out, arr=None):
    img = sitk.ReadImage(nrrd)
    data = arr if arr is not None else sitk.GetArrayFromImage(img)
    nib.save(nib.Nifti1Image(data, np.eye(4)), out)

save(TEMPLATE_NRRD, "ccf_template.nii.gz")
save(TEMPLATE_NRRD, "activation_map.nii.gz", heat)
print("✅  wrote  ccf_template.nii.gz  &  activation_map.nii.gz")
