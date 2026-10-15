"""Derive joint positions from the cleaned mesh and write joints.json (+ a marker render).

blender -b prep.blend --python landmarks.py -- <out_dir>
"""
import bpy, sys, json
import numpy as np
from mathutils import Vector

out_dir = sys.argv[sys.argv.index("--") + 1]
body = bpy.data.objects["Mascot"]
co = np.array([v.co[:] for v in body.data.vertices])
x, y, z = co.T


def section_center(p, d, radius=0.07, half=0.006):
    """Centroid of the limb cross-section through p perpendicular to direction d."""
    p, d = np.asarray(p, float), np.asarray(d, float) / np.linalg.norm(d)
    rel = co - p
    along = rel @ d
    perp = rel - np.outer(along, d)
    m = (np.abs(along) < half) & (np.linalg.norm(perp, axis=1) < radius)
    return co[m].mean(0), int(m.sum())


J = {}
# ---- legs: crotch = highest point of the gap between the legs at x=0
zs = np.linspace(-0.5, -0.1, 401)
crotch = None
for zz in zs:
    m = (np.abs(z - zz) < 0.002) & (np.abs(x) < 0.012)
    if m.sum() == 0:
        crotch = zz
    elif crotch is not None:
        break
print("crotch z", round(crotch, 4))
for side, sx in (("L", 1), ("R", -1)):
    leg = (z < crotch) & (sx * x > 0.0) & (np.abs(x) < 0.22)
    knee_z = crotch + (-0.445 - crotch) * 0.5
    knee, _ = section_center((sx * 0.08, 0.0, knee_z), (0, 0, 1), radius=0.09)
    ankle, _ = section_center((sx * 0.08, 0.02, -0.445), (0, 0, 1), radius=0.07, half=0.004)
    hip = knee.copy()
    hip[2] = crotch + 0.045
    foot = co[(z < -0.47) & (sx * x > 0.02)]
    toe = foot[foot[:, 1].argmin()].copy()
    toe[2] = -0.475
    toe[0] = ankle[0]
    J[f"hip.{side}"], J[f"knee.{side}"], J[f"ankle.{side}"], J[f"toe.{side}"] = hip, knee, ankle, toe

# ---- arms: PCA axis of the part outside the torso
for side, sx in (("L", 1), ("R", -1)):
    arm = co[(sx * x > 0.2) & (z > -0.3) & (z < 0.08)]
    c = arm.mean(0)
    _, _, vt = np.linalg.svd(arm - c)
    d = vt[0] if vt[0][0] * sx > 0 else -vt[0]          # points outward/down to the hand
    t = (arm - c) @ d
    tip = arm[t.argmax()]
    # walk inward from the tip until the section suddenly widens -> wrist cuff / sleeve
    prof = []
    for s in np.linspace(0.0, 0.2, 41):
        p = tip - d * s
        cen, n = section_center(p, d, radius=0.06, half=0.004)
        rel = co - cen
        along = rel @ d
        perp = np.linalg.norm(rel - np.outer(along, d), axis=1)
        m = (np.abs(along) < 0.004) & (perp < 0.06)
        prof.append((s, cen, np.percentile(perp[m], 90) if m.any() else 0))
    J[f"armprofile.{side}"] = [(round(s, 3), round(r, 4)) for s, _, r in prof]
    J[f"handtip.{side}"] = tip
    J[f"armdir.{side}"] = d
    J[f"armcenter.{side}"] = c

for k, v in J.items():
    if k.startswith("armprofile"):
        print(k, v)
    else:
        print(k, np.round(v, 4).tolist())
json.dump({k: (np.asarray(v).tolist() if not k.startswith("armprofile") else v) for k, v in J.items()},
          open(f"{out_dir}/landmarks_raw.json", "w"), indent=1)
