"""Mesh surgery helpers: find boundary loops and close holes with smooth, evenly triangulated patches."""
import os
import subprocess
import tempfile

import bmesh
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(__file__)


def walk_loops(edges):
    """Group boundary edges into vertex loops (closed if the walk returns to its start)."""
    nbr = {}
    for e in edges:
        a, b = e.verts
        nbr.setdefault(a, []).append(b)
        nbr.setdefault(b, []).append(a)
    used_e = set()
    loops = []
    for start in list(nbr):
        for first in nbr[start]:
            key = frozenset((start, first))
            if key in used_e:
                continue
            lp, prev, cur = [start], start, first
            used_e.add(key)
            closed = False
            while True:
                if cur is start:
                    closed = True
                    break
                lp.append(cur)
                nxt = [w for w in nbr[cur] if frozenset((cur, w)) not in used_e]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                used_e.add(frozenset((prev, cur)))
            loops.append((lp, closed))
    return loops


def fill_loop(bm, loop, target):
    """Close one boundary loop: ear-clip it, then split long interior edges until ~target length.
    Returns the new interior vertices (positions still flat; solve them with smooth_patch)."""
    try:
        f = bm.faces.new(loop)
    except ValueError:
        return [], []
    tri = bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")["faces"]
    patch = set(tri)
    new_verts = []
    for _ in range(12):
        long_edges = []
        for face in patch:
            for e in face.edges:
                if e.calc_length() > target and all(lf in patch for lf in e.link_faces) and len(e.link_faces) == 2:
                    long_edges.append(e)
        long_edges = list(set(long_edges))
        if not long_edges:
            break
        res = bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=False)
        new_verts += [g for g in res["geom_split"] if isinstance(g, bmesh.types.BMVert)]
        patch = {fc for v in new_verts for fc in v.link_faces} | {fc for fc in patch if fc.is_valid}
        bmesh.ops.triangulate(bm, faces=[fc for fc in patch if fc.is_valid and len(fc.verts) > 3])
        patch = {fc for v in new_verts if v.is_valid for fc in v.link_faces} | {fc for fc in patch if fc.is_valid}
        inner = [e for fc in patch for e in fc.edges if all(lf in patch for lf in e.link_faces)]
        bmesh.ops.beautify_fill(bm, faces=list(patch), edges=list(set(inner)))
        patch = {fc for v in new_verts if v.is_valid for fc in v.link_faces} | {fc for fc in patch if fc.is_valid}
    return [v for v in new_verts if v.is_valid], [fc for fc in patch if fc.is_valid]


def fill_planar(bm, loop, h, outward):
    """Close a roughly planar hole with an even triangle grid (spacing h) on its best-fit plane, oriented to face
    `outward`. Returns the new interior vertices; then call smooth_patch to bend them into the surrounding surface."""
    from matplotlib.path import Path as Poly
    from scipy.spatial import Delaunay

    P = np.array([v.co[:] for v in loop])
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c)
    u, w = vt[0], vt[1]
    n = np.cross(u, w)
    P2 = np.stack([(P - c) @ u, (P - c) @ w], 1)
    poly = Poly(P2)
    pts = []
    zs = np.arange(P2[:, 1].min(), P2[:, 1].max(), h * np.sqrt(3) / 2)
    for j, zz in enumerate(zs):
        xs = np.arange(P2[:, 0].min() + (h / 2 if j % 2 else 0), P2[:, 0].max(), h)
        pts += [(xx, zz) for xx in xs]
    pts = np.array(pts) if pts else np.zeros((0, 2))
    if len(pts):
        seg_d = np.full(len(pts), 9.0)
        for a, b in zip(P2, np.roll(P2, -1, axis=0)):
            ab = b - a
            t = np.clip(((pts - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
            seg_d = np.minimum(seg_d, np.linalg.norm(pts - (a + t[:, None] * ab), axis=1))
        pts = pts[poly.contains_points(pts) & (seg_d > 0.6 * h)]
    all2 = np.vstack([P2, pts])
    tri = Delaunay(all2).simplices
    tri = tri[poly.contains_points(all2[tri].mean(1))]
    new_verts = [bm.verts.new(Vector(c + u * p[0] + w * p[1])) for p in pts]
    ring = list(loop) + new_verts
    out = Vector(outward)
    made = 0
    for a, b, cc in tri:
        va, vb, vc = ring[a], ring[b], ring[cc]
        nn = (vb.co - va.co).cross(vc.co - va.co)
        try:
            bm.faces.new((va, vb, vc) if nn.dot(out) > 0 else (va, vc, vb))
            made += 1
        except ValueError:
            pass
    return new_verts, made


def smooth_patch(bm, verts, axes="012"):
    """Biharmonic solve for `verts` against the rest of the mesh (see ../fill.py)."""
    if not verts:
        return
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    co = np.array([v.co[:] for v in bm.verts])
    tris = np.array([[v.index for v in f.verts] for f in bm.faces if len(f.verts) == 3])
    mask = np.zeros(len(co), bool)
    mask[[v.index for v in verts]] = True
    tmp = tempfile.mkdtemp()
    np.savez(f"{tmp}/in.npz", co=co, tris=tris, mask=mask)
    out = subprocess.run(["python3", "-I", os.path.join(HERE, "..", "fill.py"), f"{tmp}/in.npz", f"{tmp}/out.npz",
                          axes], check=True, capture_output=True, text=True).stdout.strip()
    new = np.load(f"{tmp}/out.npz")["co"]
    for v in verts:
        v.co = Vector(new[v.index])
    return out
