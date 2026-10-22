"""Fair the raw head (implicit cotangent fairing) to melt the sculpted seam ridge, pit and dents; the face front and
everything below the head are pinned, so the engraved face and the body stay exactly as they are."""
import bpy, bmesh, sys, math, os, numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import spsolve
src, out = sys.argv[-2], sys.argv[-1]
T_TOTAL, STEPS = float(os.environ.get("FAIR_T", 2e-4)), 3
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
o = next(o for o in bpy.data.objects if o.type == 'MESH'); me = o.data
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.verts.ensure_lookup_table()
P = np.array([v.co[:] for v in bm.verts]); F = np.array([[v.index for v in f.verts] for f in bm.faces]); n = len(P)
# masks in world space: the centring is a node offset, not baked into the vertices
Mw = np.array(o.matrix_world)
x, y, z = (P @ Mw[:3, :3].T + Mw[:3, 3]).T
print("WORLD z range", z.min().round(3), z.max().round(3))
# the face: an ellipse over the front (eyes, brows, mouth, blush), with a soft edge so there is no step around it
fr = ((x - 0.027) / 0.27) ** 2 + ((z - 0.17) / 0.17) ** 2
face = (y < -0.05) & (fr < 1.0)
free = (z > 0.02) & ~face
def lap(P):
    v0, v1, v2 = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    def cot(a, b): return np.clip(np.einsum("ij,ij->i", a, b) / np.maximum(np.linalg.norm(np.cross(a, b), axis=1), 1e-12), 0, 10)
    c0, c1, c2 = cot(v1 - v0, v2 - v0), cot(v2 - v1, v0 - v1), cot(v0 - v2, v1 - v2)
    rows = np.concatenate([F[:, 1], F[:, 2], F[:, 2], F[:, 0], F[:, 0], F[:, 1]]); cols = np.concatenate([F[:, 2], F[:, 1], F[:, 0], F[:, 2], F[:, 1], F[:, 0]])
    W = sp.coo_matrix((0.5 * np.concatenate([c0, c0, c1, c1, c2, c2]), (rows, cols)), shape=(n, n)).tocsr()
    area = 0.5 * np.linalg.norm(np.cross(v1 - v0, v2 - v0), axis=1)
    mass = np.bincount(F.ravel(), weights=np.repeat(area / 3, 3), minlength=n)
    return W - sp.diags(np.asarray(W.sum(1)).ravel()), mass
for _ in range(STEPS):
    L, mass = lap(P)
    w = (free & (mass > 0)).astype(float)
    A = (sp.diags(w) @ (sp.diags(mass) - (T_TOTAL / STEPS) * L) + sp.diags(1 - w)).tocsc()
    P = np.column_stack([spsolve(A, np.where(w > 0, mass, 1.0) * P[:, k]) for k in range(3)])
for v, p in zip(bm.verts, P): v.co = p
print(f"FAIR free verts {int(free.sum())}, face pinned {int(face.sum())}, t {T_TOTAL}")
# shading: Tripo's own normals where nothing moved (they keep the engraved face smooth), fresh ones on the faired head
# (Tripo's would still draw the old seam there)
orig = np.array([c.vector[:] for c in me.corner_normals])
corner_vert = np.array([l.vertex_index for l in me.loops])
moved = np.zeros(n, bool); moved[free] = True
bm.to_mesh(me); bm.free()
if me.has_custom_normals:
    me.attributes.remove(me.attributes["custom_normal"])
for p in me.polygons: p.use_smooth = True
fresh = np.array([c.vector[:] for c in me.corner_normals])
mix = np.where(moved[corner_vert][:, None], fresh, orig)
me.normals_split_custom_set([tuple(v) for v in mix])
print(f"NORMALS kept {int((~moved[corner_vert]).sum())} corners, fresh {int(moved[corner_vert].sum())}")
o.select_set(True); bpy.context.view_layer.objects.active = o
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO")
