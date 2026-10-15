"""Measure eyes + smile in the reference PNG, map them into mesh coords, and paint the eye texture.

Usage: python3 -I features.py <ref.png> <register.json> <out_dir>
Writes <out_dir>/features.json and <out_dir>/eye.png
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ref_png, reg_json, out_dir = sys.argv[1:4]
reg = json.load(open(reg_json))
im = np.array(Image.open(ref_png).convert("RGBA")).astype(float)
rgb, alpha = im[..., :3], im[..., 3]
lum = rgb.mean(-1)

def to_mesh(pu, pv):
    return (pu - reg["bx"]) / reg["ax"], (pv - reg["bz"]) / reg["az"]

# head is everything above the collar; eyes/smile are the non-white blobs in it
rows = np.arange(im.shape[0])[:, None]
head_rows = rows < 0.42 * im.shape[0]
feat = (alpha > 200) & (lum < 150) & head_rows
feat = ndimage.binary_fill_holes(ndimage.binary_closing(feat, iterations=2))
lab, n = ndimage.label(feat)
sizes = ndimage.sum(feat, lab, range(1, n + 1))
order = np.argsort(sizes)[::-1] + 1
blobs = [lab == k for k in order[:3]]
eyes = sorted(blobs[:2], key=lambda m: np.nonzero(m)[1].mean())
smile = blobs[2]

out = {"eyes": []}
for m in eyes:
    v, u = np.nonzero(m)
    cu, cv = u.mean(), v.mean()
    cov = np.cov(np.stack([u - cu, v - cv]))
    evals, evecs = np.linalg.eigh(cov)
    # solid ellipse: variance along axis = r^2 / 4
    r_minor, r_major = 2 * np.sqrt(evals)
    major = evecs[:, 1]
    tilt = float(np.degrees(np.arctan2(-major[1], major[0])))  # image v is down
    cx, cz = to_mesh(cu, cv)
    out["eyes"].append({
        "cx": cx, "cz": cz,
        "rx": r_minor / abs(reg["ax"]), "rz": r_major / abs(reg["az"]),
        "tilt_deg": tilt - 90 if tilt > 0 else tilt + 90,
    })

v, u = np.nonzero(smile)
pts = []
for col in range(u.min(), u.max() + 1):
    rr = v[u == col]
    if len(rr):
        x, z = to_mesh(col, rr.mean())
        pts.append([x, z, len(rr) / abs(reg["az"])])
pts = np.array(pts)
k = max(1, len(pts) // 24)
out["smile"] = {"points": pts[::k, :2].tolist() + [pts[-1, :2].tolist()],
                "thickness": float(np.median(pts[:, 2]))}
json.dump(out, open(f"{out_dir}/features.json", "w"), indent=2)
for e in out["eyes"]:
    print("eye", {k: round(v, 4) for k, v in e.items()})
print("smile thickness", round(out["smile"]["thickness"], 4), "x-span",
      round(pts[:, 0].min(), 4), round(pts[:, 0].max(), 4), "z", round(pts[:, 1].min(), 4), round(pts[:, 1].max(), 4))

# ---- eye texture (row 0 = top), matched to the reference eye ----
S = 512
yy, xx = np.mgrid[0:S, 0:S]
u = (xx + 0.5) / S
vv = 1 - (yy + 0.5) / S
du, dv = (u - 0.5) / 0.5, (vv - 0.5) / 0.5
r = np.sqrt(du ** 2 + dv ** 2)

def srgb(c):
    return np.array(c, float) / 255

def blob(cu, cv, s):
    return np.exp(-(((u - cu) ** 2 + (vv - cv) ** 2) / (2 * s ** 2)))

col = np.zeros((S, S, 3))
col[:] = srgb((6, 9, 24))
col = col * (1 - 0.6 * np.clip((r - 0.75) / 0.25, 0, 1))[..., None]          # darker rim
crescent = (np.clip((-dv - 0.1) / 0.7, 0, 1) ** 1.4 * np.clip((r - 0.35) / 0.45, 0, 1)
            * (1 - np.clip((r - 0.88) / 0.1, 0, 1)) * (1 - 0.35 * np.clip((du + 0.2) / 1.2, 0, 1)))
col += crescent[..., None] * srgb((22, 78, 225))
col += 0.9 * blob(0.3, 0.17, 0.07)[..., None] * srgb((40, 120, 255))       # bright blue spot bottom-left
col += 0.55 * blob(0.29, 0.16, 0.018)[..., None] * srgb((200, 225, 255))
col += 0.25 * blob(0.22, 0.55, 0.06)[..., None] * srgb((30, 60, 160))       # soft sheen left
hl = np.clip((0.15 - np.sqrt((u - 0.7) ** 2 + (vv - 0.735) ** 2)) / 0.012, 0, 1)
col = col * (1 - hl[..., None]) + hl[..., None] * srgb((252, 252, 255))     # main highlight
col = np.clip(col, 0, 1)
Image.fromarray((col * 255).astype(np.uint8)).save(f"{out_dir}/eye.png")
