"""Fit a scale+offset mapping mesh front-view (x, z) -> reference PNG pixels.

Usage: python3 -I register.py <mesh_front_render.png> <ref.png> <out.json>
The mesh render must be the 768px ortho front shot from inspect.py (ortho_scale 1.1,
centered on the bbox center, which is the origin for this model).
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage, optimize

front_png, ref_png, out_json = sys.argv[1:4]
USE_ALL = len(sys.argv) > 4 and sys.argv[4] == "all"  # reference in the same pose as the mesh: fit everything
RES, SCALE = 768, 1.1

mesh = np.array(Image.open(front_png))[..., 3] > 128
ref = np.array(Image.open(ref_png).convert("RGBA"))[..., 3] > 128
refsoft = ndimage.gaussian_filter(ref.astype(float), 2)

v, u = np.nonzero(mesh)
x = (u + 0.5 - RES / 2) * SCALE / RES
z = (RES / 2 - v - 0.5) * SCALE / RES
# arms are posed differently in the A-pose PNG: fit on head/torso/legs only
keep = np.ones_like(x, bool) if USE_ALL else ~((np.abs(x) > 0.19) & (z < 0.06))
x, z = x[keep], z[keep]

ys, xs = np.nonzero(ref)
p0 = np.array([
    (xs.max() - xs.min()) / 0.74, (xs.max() + xs.min()) / 2,   # ax, bx
    -(ys.max() - ys.min()) / 1.0, (ys.max() + ys.min()) / 2,   # az, bz
])

def sample(p):
    pu = p[0] * x + p[1]
    pv = p[2] * z + p[3]
    return ndimage.map_coordinates(refsoft, [pv, pu], order=1, cval=0.0)

def loss(p):
    # fraction of (non-arm) mesh pixels that land outside the reference silhouette,
    # plus a term penalising reference area left uncovered (stops the fit from shrinking)
    inside = sample(p).mean()
    area_ratio = (abs(p[0] * p[2]) * keep.sum() * (SCALE / RES) ** 2) / ref.sum()
    return (1 - inside) + 0.5 * abs(1 - area_ratio)

res = optimize.minimize(loss, p0, method="Nelder-Mead",
                        options={"xatol": 1e-3, "fatol": 1e-6, "maxiter": 4000})
p = res.x
print("init loss", round(loss(p0), 4), "-> fitted", round(res.fun, 4), "params", np.round(p, 3).tolist())
json.dump({"ax": p[0], "bx": p[1], "az": p[2], "bz": p[3],
           "ref_w": ref.shape[1], "ref_h": ref.shape[0]}, open(out_json, "w"), indent=2)

# overlap diagnostic in mesh frame
H = W = RES
vv, uu = np.mgrid[0:H, 0:W]
gx = (uu + 0.5 - RES / 2) * SCALE / RES
gz = (RES / 2 - vv - 0.5) * SCALE / RES
warped = ndimage.map_coordinates(ref.astype(float), [p[2] * gz + p[3], p[0] * gx + p[1]], order=0) > 0.5
diff = np.zeros((H, W, 3), np.uint8)
diff[mesh & warped] = (200, 200, 200)
diff[mesh & ~warped] = (255, 0, 0)
diff[~mesh & warped] = (0, 120, 255)
Image.fromarray(diff).save(out_json.replace(".json", "_diff.png"))
body = mesh & ~((np.abs(gx) > 0.19) & (gz < 0.06))
print("IoU all", round((mesh & warped).sum() / (mesh | warped).sum(), 3),
      "| body pixels covered", round((body & warped).sum() / body.sum(), 3))
