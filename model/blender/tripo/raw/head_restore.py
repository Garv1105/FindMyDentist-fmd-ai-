"""Give the rigged head back the raw sculpt's shape: its puffy face and full crown.

The rigged head's face was cut out and refilled with a smooth minimal patch (prep_tripo.py), so the face reads flat
next to the sculpt and the reference art, and its crown was faired softer. Here:
  1. target: the raw sculpt's head, with its engraved features (closed-eye grooves, brows, the open mouth) found as
     dips against a heavily smoothed copy of itself, and filled from that smoothed copy, so the fill keeps the
     face's curvature instead of flattening it;
  2. a displacement field over the rigged head: each vertex to its nearest point on the target. The mouth pocket
     (carved behind the face) and the neck rim take theirs from their surroundings, so the pocket rides along whole
     and the bottom still meets the neck and collar;
  3. the face kit (eyes, lids, brows, smile, mouth, blush) moves with the field, so it stays seated on the skin.
NumPy only (Blender's Python has no SciPy).
"""
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

KIT = ["Eye.L", "Eye.R", "Lid.L", "Lid.R", "Brow.L", "Brow.R", "Blush.L", "Blush.R", "Smile", "MouthCover", "Tongue3D"]


def _mesh_arrays(obj, zmin):
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    faces = [f for f in bm.faces if min((mw @ v.co).z for v in f.verts) > zmin]
    used = sorted({v.index for f in faces for v in f.verts})
    remap = {old: new for new, old in enumerate(used)}
    V = np.array([tuple(mw @ bm.verts[i].co) for i in used])
    F = [[remap[v.index] for v in f.verts] for f in faces]
    bm.free()
    return V, F, used


def _edges(F, n):
    e = set()
    for f in F:
        for a, b in zip(f, f[1:] + f[:1]):
            e.add((min(a, b), max(a, b)))
    e = np.array(sorted(e))
    deg = np.bincount(e.ravel(), minlength=n).astype(float)
    return e, np.maximum(deg, 1)


def _avg(X, e, deg):
    """Mean of each vertex's neighbours."""
    S = np.zeros_like(X)
    np.add.at(S, e[:, 0], X[e[:, 1]])
    np.add.at(S, e[:, 1], X[e[:, 0]])
    return S / deg.reshape((-1,) + (1,) * (X.ndim - 1))


def _normals(V, F):
    N = np.zeros_like(V)
    for f in F:
        a, b, c = V[f[0]], V[f[1]], V[f[2]]
        n = np.cross(b - a, c - a)
        for i in f:
            N[i] += n
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)



def raw_target(raw_obj, neck_z):
    """The raw head with its engraved features filled: (V, F) in world space."""
    V, F, _ = _mesh_arrays(raw_obj, neck_z - 0.01)
    e, deg = _edges(F, len(V))
    # Taubin smoothing (no shrink): what the head would be without centimetre-scale detail
    S = V.copy()
    for _ in range(60):
        S += 0.5 * (_avg(S, e, deg) - S)
        S -= 0.53 * (_avg(S, e, deg) - S)
    N = _normals(S, F)
    dip = np.einsum("ij,ij->i", V - S, N)
    front = (N[:, 1] < -0.2) & (V[:, 2] > 0.0) & (V[:, 2] < 0.34) & (np.abs(V[:, 0]) < 0.3)
    feat = front & (dip < -0.0012)
    for _ in range(4):  # a few rings round each groove, so the fill starts on clean skin
        feat |= front & (_avg(feat.astype(float), e, deg) > 0)
    # the fill: the smoothed head itself there, which follows the face's own curve (a single fitted surface can't:
    # the face wraps too far round)
    T = V.copy()
    T[feat] = S[feat]
    # blend the fill's edge into the skin around it
    edge = feat.copy()
    for _ in range(3):
        edge |= front & (_avg(edge.astype(float), e, deg) > 0)
    for _ in range(25):
        T[edge] = _avg(T, e, deg)[edge]
    print(f"TARGET raw head {len(V)} verts; features {feat.sum()} filled; fill depth max {(-dip[feat]).max() * 1000:.1f} mm")
    return T, F


def restore(head, kit, target, neck_z):
    """Move the rigged head (and its face kit) onto the target shape."""
    T, F = target
    bvh = BVHTree.FromPolygons([Vector(p) for p in T], F)
    mw, mwi = head.matrix_world, head.matrix_world.inverted()
    P, HF, idx = _mesh_arrays(head, -9)
    e, deg = _edges(HF, len(P))
    D = np.zeros_like(P)
    ok = np.zeros(len(P), bool)
    # the mouth pocket: behind the mouth cover, carved into the head
    cover = np.array([tuple(kit["MouthCover"].matrix_world @ v.co) for v in kit["MouthCover"].data.vertices])
    lo, hi = cover.min(0) - (0.012, 0.004, 0.012), cover.max(0) + (0.012, 0.08, 0.012)
    pocket = np.all((P > lo) & (P < hi), axis=1)
    for i, p in enumerate(P):
        if pocket[i] or p[2] < neck_z + 0.005:
            continue
        hit = bvh.find_nearest(Vector(p), 0.05)
        if hit[0] is not None:
            D[i], ok[i] = np.array(hit[0]) - p, True
    for _ in range(300):  # pocket and rim take their surroundings' displacement
        D[~ok] = _avg(D, e, deg)[~ok]
    for _ in range(40):  # the sculpt's surface noise out: only the broad change of shape is kept
        D = 0.5 * D + 0.5 * _avg(D, e, deg)
    t = np.clip((P[:, 2] - neck_z) / 0.08, 0, 1)
    D *= (t * t * (3 - 2 * t))[:, None]  # nothing moves at the neck, all of it from 6 cm up
    print(f"RESTORE head: {ok.sum()}/{len(P)} verts matched, {pocket.sum()} in the mouth pocket; "
          f"move mean {np.linalg.norm(D, axis=1).mean() * 1000:.1f} mm, max {np.linalg.norm(D, axis=1).max() * 1000:.1f} mm")
    for i, p in zip(idx, P + D):
        head.data.vertices[i].co = mwi @ Vector(p)
    head.data.update()
    kd = KDTree(len(P))
    for i, p in enumerate(P):
        kd.insert(Vector(p), i)
    kd.balance()
    # each piece moves whole, by the shift under its centre: moving each vertex by its own shift leaves glossy pieces
    # (the eyes) with tiny bumps that sparkle
    for obj in kit.values():
        ow, owi = obj.matrix_world, obj.matrix_world.inverted()
        centre = sum((ow @ v.co for v in obj.data.vertices), Vector()) / len(obj.data.vertices)
        shift = owi.to_3x3() @ Vector(D[kd.find(centre)[1]])
        for v in obj.data.vertices:
            v.co += shift
        obj.data.update()
