"""Tripo mascots, step 1: decimate, flatten the sculpted face, cut off the mitten hands, paint materials.

blender -b --factory-startup --python prep_tripo.py -- <src.glb> <out dir> [sit]
Writes <out dir>/dec.blend (cached decimation, the slow part) and <out dir>/prep.blend.
"sit" = the seated model ("tooth character 3d model sitting.glb"). Both models' hands (mittens, fused mudra rings)
are cut at the blue cuff for rigged gloves. Both heads are faired hard
(Tripo sculpted seam ridges and creases over the crown and down the back, and a pit on top of the seated one).

Measured on "tooth character 3d model.glb" (Tripo, 0.98 tall, feet at z=0, -Y = front, character's left = +X);
everything below is in the shifted frame (z - Z0), so the model is centred like the older mascots:
  painted eyes at x=±0.093, z=0.21 (0.072 x 0.090); brows x=±0.114, z=0.306; open mouth z=0.11..0.157, x=±0.04;
  sleeve cuff centre (±0.288, -0.058, -0.173); mitten tip (±0.335, -0.08, -0.255); head starts at z≈0.045.
"""
import bpy, bmesh, sys, os, json, struct, subprocess, tempfile, io
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_DIR = argv[:2]
SIT = argv[2:3] == ["sit"]
HERE = os.path.dirname(__file__)
TARGET_TRIS = 160_000
Z0 = 0.4905               # half the height: feet end up at z=-0.49
Z_NECK = 0.045            # above: tooth head
CUFF = np.array((0.288, -0.058, -0.173))
TIP = np.array((0.335, -0.080, -0.255))
HAND_REACH, HAND_R = 0.16, 0.075   # hand vertices lie within HAND_REACH of TIP and HAND_R of the cuff axis
                                   # (seated: within HAND_R of a ball spanning the band and the fingers)
FACE_C, FACE_RX, FACE_RZ = (0.0, 0.2145), 0.21, 0.14   # ellipse (x, z) over the sculpted face
FACE_ZMIN = -1.0          # nothing of the face patch below this (keeps the collar out of it)
FRONT_Z = 0.22            # centre of the extra fairing over the front of the head
FRONT_FAIR_T = 4e-4       # how hard the front (old face plate) is faired
HEAD_FAIR_T = 4e-4        # strong: irons out sculpted creases (see the seam pass below); the crown's cusps stay
SHOE_Z = -0.400           # white below this on the legs = shoes
if SIT:
    # seated export, 0.98 tall: closed-eye arcs at x≈-0.10/+0.155, z≈0.12 (the face sits ~2.5 cm right of the
    # head's centre), brows z≈0.23, open mouth z≈0.04-0.075; the head's underside meets the collar at z≈-0.02
    Z0, Z_NECK = 0.49, -0.01
    HEAD_FAIR_T = 4e-5    # the scan's exact head (user): only decimation noise and the sculpted seam go
    FRONT_FAIR_T = 1e-4   # just blends the filled-in face (engraved eyes/brows/mouth) into the head
    FACE_C, FACE_RX, FACE_RZ, FACE_ZMIN, FRONT_Z = (0.027, 0.15), 0.235, 0.125, 0.025, 0.15
    SHOE_Z = -9.0         # socks and hands are found as small white islands instead
    CUFF = np.array((0.300, -0.120, -0.210))   # blue cuff band; the mudra hand reaches out and forward from it
    TIP = np.array((0.400, -0.290, -0.150))
    HAND_REACH, HAND_R = 0.21, 0.06
WHITE, BLUE = 0, 1

# ---------------------------------------------------------------- decimated mesh (cached)
cache = os.path.join(OUT_DIR, "dec.blend")
bpy.ops.wm.read_factory_settings(use_empty=True)
if not os.path.exists(cache):
    bpy.ops.import_scene.gltf(filepath=SRC, merge_vertices=True)  # else every UV seam is an open edge
    body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    m = body.modifiers.new("dec", "DECIMATE")
    m.ratio = TARGET_TRIS / sum(len(p.vertices) - 2 for p in body.data.polygons)
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
    body.name = body.data.name = "Mascot"
    body.data.materials.clear()
    for im in list(bpy.data.images):
        bpy.data.images.remove(im)
    bpy.ops.wm.save_as_mainfile(filepath=cache)
    bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(cache) as (src, dst):
    dst.objects = ["Mascot"]
body = dst.objects[0]
bpy.context.scene.collection.objects.link(body)
bpy.context.view_layer.objects.active = body
body.select_set(True)
me = body.data
print("decimated tris", len(me.polygons))
if me.has_custom_normals:  # Tripo's baked normals: stale once the mesh is edited (they kept old seams in the shading)
    me.attributes.remove(me.attributes["custom_normal"])


def glb_image(path, key):
    """Decode one embedded texture (by name suffix) as float RGB (rows top-down)."""
    from PIL import Image
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    b0 = 20 + n + 8
    im = next(i for i in j["images"] if i.get("name", "").endswith(key))
    bv = j["bufferViews"][im["bufferView"]]
    o = b0 + bv.get("byteOffset", 0)
    return np.asarray(Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB"), dtype=np.float32) / 255


# ---------------------------------------------------------------- blue/white from Tripo's texture (per vertex)
tex = glb_image(SRC, "basecolor.jpg")
H, W_ = tex.shape[:2]
uv = np.zeros(len(me.loops) * 2)
me.uv_layers.active.data.foreach_get("uv", uv)
uv = uv.reshape(-1, 2)
lv = np.zeros(len(me.loops), int)
me.loops.foreach_get("vertex_index", lv)
px = tex[np.clip(((1 - uv[:, 1]) * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W_).astype(int), 0, W_ - 1)]
blue_loop = ((px[:, 2] - px[:, 0]) > 0.25) & (px[:, 2] > 0.3)
blue_v = np.bincount(lv, weights=blue_loop, minlength=len(me.vertices)) / np.maximum(
    np.bincount(lv, minlength=len(me.vertices)), 1)
me.attributes.new("blue", "FLOAT", "POINT").data.foreach_set("value", blue_v.astype(np.float32))
del tex, px

bm = bmesh.new()
bm.from_mesh(me)
bm.transform(__import__("mathutils").Matrix.Translation((0, 0, -Z0)))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
blay = bm.verts.layers.float["blue"]
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()


def coords():
    return np.array([v.co[:] for v in bm.verts])


def tris_of(b):
    return np.array([[v.index for v in f.verts] for f in b.faces if len(f.verts) == 3])


def _smooth01(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def components():
    lab = np.full(len(bm.verts), -1)
    n = 0
    for st in bm.verts:
        if lab[st.index] >= 0:
            continue
        lab[st.index] = n
        stack = [st]
        while stack:
            v = stack.pop()
            for e in v.link_edges:
                w = e.other_vert(v)
                if lab[w.index] < 0:
                    lab[w.index] = n
                    stack.append(w)
        n += 1
    return lab


lab = components()
sizes = np.bincount(lab)
small = [v for v in bm.verts if sizes[lab[v.index]] < 200]
print(f"components {len(sizes)}, largest {sorted(sizes)[-3:]}, dropping {len(small)} verts in tiny pieces")
bmesh.ops.delete(bm, geom=small, context="VERTS")
bm.verts.ensure_lookup_table()

sys.path.insert(0, os.path.join(HERE, "..", "sit"))
import meshfix as MF  # noqa: E402

# ---------------------------------------------------------------- cut off the mitten hands (rig adds gloves)
# Between the coat cuff and the mitten Tripo painted a blue scrubs band. The cut plane is that band's far edge,
# perpendicular to the band; everything of the hand beyond it goes and the sleeve end is capped in blue.
co = coords()
blue = np.array([v[blay] for v in bm.verts]) > 0.5
cut_info = {}
for s, sx in (("L", 1), ("R", -1)):
    m = np.array((sx, 1, 1))
    c, tip = CUFF * m, TIP * m
    band = blue & (np.linalg.norm(co - c, axis=1) < 0.07)
    P = co[band]
    cen = P.mean(0)
    if SIT:  # the seated band is short and tilted: cut square to the line from the band to the fingers instead
        hc = co[(np.linalg.norm(co - tip, axis=1) < 0.06) & ~blue].mean(0)
        n = (hc - cen) / np.linalg.norm(hc - cen)
        off = np.percentile((P - cen) @ n, 90)
    else:
        n = np.linalg.svd(P - cen)[2][2]       # thinnest direction of the band ring = its axis
        if n @ (tip - cen) < 0:
            n = -n
        off = np.percentile((P - cen) @ n, 97)
    plane_d = (co - cen) @ n
    radial = np.linalg.norm((co - cen) - np.outer(plane_d, n), axis=1)
    if SIT:  # everything of the hand: a ball round it, beyond the cut
        mid = (cen + hc) / 2
        cand = (plane_d > off) & (np.linalg.norm(co - mid, axis=1) < np.linalg.norm(hc - cen) / 2 + HAND_R)
    else:
        cand = (plane_d > off) & (radial < HAND_R) & (np.linalg.norm(co - tip, axis=1) < HAND_REACH)
    seed = int(np.argmax(np.where(cand, plane_d, -9)))
    seen, stack = {seed}, [bm.verts[seed]]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            w = e.other_vert(v)
            if w.index not in seen and cand[w.index]:
                seen.add(w.index)
                stack.append(w)
    cut_info[s] = dict(centre=(cen + n * off).tolist(), axis=n.tolist(), band_r=float(np.median(
        np.linalg.norm((P - cen) - np.outer((P - cen) @ n, n), axis=1))))
    print(f"hand {s}: band {band.sum()} verts, axis {n.round(3)}, cut at {off:.4f}, removing {len(seen)} verts")
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in seen], context="VERTS")
    bm.verts.ensure_lookup_table()
    # finger tips that only touched the rest of the hand (the mudra ring) are now loose: drop them
    lab = components()
    sizes = np.bincount(lab)
    co = coords()
    loose = [v for v in bm.verts if sizes[lab[v.index]] < 5000 and np.linalg.norm(co[v.index] - tip) < 0.2]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.verts.ensure_lookup_table()
    if loose:
        print(f"hand {s}: {len(loose)} loose finger verts dropped")
    co = coords()
    blue = np.array([v[blay] for v in bm.verts]) > 0.5
for s, info in cut_info.items():  # cap each sleeve end with an even flat patch (blue, like the band)
    c = Vector(info["centre"])
    rim = [e for e in bm.edges if e.is_boundary and (e.verts[0].co - c).length < 0.09]
    for lp, closed in MF.walk_loops(rim):
        if not closed or len(lp) < 8:
            continue
        nv, made = MF.fill_planar(bm, lp, 0.005, Vector(info["axis"]))
        for v in list(lp) + nv:
            v[blay] = 1.0
        # the cut follows the scan's triangles: relax the rim and two rings each side into an even edge
        rim_band = set(lp)
        for _ in range(2):
            rim_band |= {w for v in rim_band for e in v.link_edges for w in e.verts}
        for _ in range(8):
            bmesh.ops.smooth_vert(bm, verts=list(rim_band), factor=0.5, use_axis_x=True, use_axis_y=True,
                                  use_axis_z=True)
        print(f"cap {s}: loop {len(lp)}, {len(nv)} new verts, {made} faces")
json.dump(cut_info, open(os.path.join(OUT_DIR, "cuffs.json"), "w"), indent=1)

# ---------------------------------------------------------------- seated: swap the scanned sleeves out
# Tripo fused the seated arms into the torso (no torso surface under them) and the left forearm to its knee, so the
# scanned sleeves tear or drag the coat as soon as the arms leave the lap. rig_tripo builds clean procedural sleeves
# with a ball shoulder inside the torso instead (as for the old seated mascot): delete the sleeves, keep the main
# body only, and close the torso sides with smooth patches.
if SIT:
    SHOULDER_S, ELBOW_S = np.array((0.165, 0.03, -0.10)), np.array((0.26, 0.03, -0.235))
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    co = coords()
    nrm = np.array([v.normal[:] for v in bm.verts])

    def seg(p, a, b):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        c = a + t[:, None] * ab
        return np.linalg.norm(p - c, axis=1), c

    dele = np.zeros(len(co), bool)
    for s, sx in (("L", 1), ("R", -1)):
        mm = np.array((sx, 1, 1))
        sh, el, wr = SHOULDER_S * mm, ELBOW_S * mm, np.array(cut_info[s]["centre"])
        d_up, c_up = seg(co, sh, el)
        d_fo, c_fo = seg(co, el, wr)
        facing_up = (nrm * (c_up - co)).sum(1) / np.maximum(d_up, 1e-9)
        facing_fo = (nrm * (c_fo - co)).sum(1) / np.maximum(d_fo, 1e-9)
        side = sx * co[:, 0] > 0.03
        upper = side & (d_up < 0.070) & (facing_up < 0.25)     # the torso side faces the upper arm: kept
        knee_top = (co[:, 2] < -0.265) & (facing_fo > 0.2)        # the lap under the forearm faces it: kept
        dele |= upper | (side & (d_fo < 0.090) & ~knee_top)
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(dele)[0]], context="VERTS")
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    lab = components()
    main = np.bincount(lab).argmax()
    scraps = [v for v in bm.verts if lab[v.index] != main]
    bmesh.ops.delete(bm, geom=scraps, context="VERTS")
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    print(f"sleeves removed: {int(dele.sum())} verts + {len(scraps)} in detached scraps")
    patch_verts, rims = [], set()
    for lp, closed in MF.walk_loops([e for e in bm.edges if e.is_boundary]):
        rims |= set(lp)
        if not closed or len(lp) <= 12:
            continue
        out = Vector()
        for i in range(len(lp)):
            e = bm.edges.get((lp[i], lp[(i + 1) % len(lp)]))
            if e and e.link_faces:
                out += e.link_faces[0].normal
        nv, made = MF.fill_planar(bm, lp, 0.0055, out)
        patch_verts += nv
        print(f"  torso patch: loop {len(lp)}, {len(nv)} new verts, {made} faces")
    print(MF.smooth_patch(bm, [v for v in patch_verts if v.is_valid]))
    res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.triangulate(bm, faces=res["faces"])
    seam = {v for v in rims if v.is_valid}  # the cut followed the scan's triangles: relax a band round each rim
    for _ in range(2):
        seam |= {w for v in seam for e in v.link_edges for w in e.verts}
    for _ in range(8):
        bmesh.ops.smooth_vert(bm, verts=list(seam), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    print(f"left-over holes closed: {len(res['faces'])}, rim band relaxed: {len(seam)} verts, "
          f"open edges {sum(e.is_boundary for e in bm.edges)}")


bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# ---------------------------------------------------------------- seated: tuck the coat in under the arms
# The scan's coat front panels draped over its forearms; with the procedural sleeves they hang in the air under the
# armpits as "wings" 2-5 cm out from the torso (z -0.14 .. -0.26). Pull all coat surface there that lies beyond the
# torso's side (|x| > 0.18) back toward it, fading out above the lap (the skirt spread over the knees stays) and
# toward the shoulders.
if SIT:
    co = coords()
    white = np.array([v[blay] for v in bm.verts]) < 0.5
    ax = np.abs(co[:, 0])
    k = _smooth01(co[:, 2], -0.31, -0.25) * (1 - _smooth01(co[:, 2], -0.09, -0.05)) * white
    tucked = np.where(ax > 0.18, 0.18 + (ax - 0.18) * 0.25, ax)
    for v, x_ in zip(bm.verts, np.sign(co[:, 0]) * (ax + k * (tucked - ax))):
        v.co.x = x_
    print(f"coat tucked in under the arms: {int(((ax > 0.18) & (k > 0.01)).sum())} verts")
    # ...and the thin fins that still stand out from the torso side there are cut off and the side patched flush
    co = coords()
    reach = 0.165 + 0.25 * (1 - _smooth01(co[:, 2], -0.29, -0.25) * (1 - _smooth01(co[:, 2], -0.06, -0.035)))
    fin = (np.abs(co[:, 0]) > reach) & white & (co[:, 2] > -0.275) & (co[:, 2] < Z_NECK - 0.03)  # coat only: not the knees
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(fin)[0]], context="VERTS")
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    lab = components()
    main = np.bincount(lab).argmax()
    scraps = [v for v in bm.verts if lab[v.index] != main]
    bmesh.ops.delete(bm, geom=scraps, context="VERTS")
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    patch = []
    for lp, closed in MF.walk_loops([e for e in bm.edges if e.is_boundary]):
        if closed and len(lp) > 12:
            out = Vector()
            for i in range(len(lp)):
                e = bm.edges.get((lp[i], lp[(i + 1) % len(lp)]))
                if e and e.link_faces:
                    out += e.link_faces[0].normal
            nv, _ = MF.fill_planar(bm, lp, 0.0055, out)
            patch += nv
    print(MF.smooth_patch(bm, [v for v in patch if v.is_valid]))
    res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.triangulate(bm, faces=res["faces"])
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    side = [v for v in bm.verts if abs(v.co.x) > 0.13 and -0.27 < v.co.z < -0.04 and v[blay] < 0.5]
    for _ in range(15):  # iron the coat side under the arms: no folds left from the cut
        bmesh.ops.smooth_vert(bm, verts=side, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    print(f"under-arm fins cut: {int(fin.sum())} verts (+{len(scraps)} loose), {len(patch)} patch verts, "
          f"side ironed {len(side)} verts")

# ---------------------------------------------------------------- face: rebuild the patch over the sculpted face
# Delete the sculpted eyes/brows/mouth and re-triangulate the hole as a height field seen from the front (fresh
# even grid); only its depth is solved (biharmonic, matching position and slope of the head around it).
from scipy.spatial import Delaunay  # noqa: E402
from matplotlib.path import Path as Poly  # noqa: E402

co = coords()
x, y, z = co.T
inside = ((x - FACE_C[0]) / FACE_RX) ** 2 + ((z - FACE_C[1]) / FACE_RZ) ** 2 < 1
face = inside & (y < -0.12) & (z > FACE_ZMIN)
# closing on the vertex graph: a one-vertex bridge left inside the region would pinch its rim into two loops
ev = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])


def _dilate(m):
    o = m.copy()
    o[ev[:, 1][m[ev[:, 0]]]] = True
    o[ev[:, 0][m[ev[:, 1]]]] = True
    return o


def _erode(m):
    o = m.copy()
    o[ev[:, 1][~m[ev[:, 0]]]] = False
    o[ev[:, 0][~m[ev[:, 1]]]] = False
    return o


face |= _erode(_dilate(face))
bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(face[v.index] for v in f.verts)], context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.verts.ensure_lookup_table()
rim_edges = [e for e in bm.edges if e.is_boundary and all(
    v.co.y < -0.10 and ((v.co.x - FACE_C[0]) / (FACE_RX + 0.03)) ** 2 + ((v.co.z - FACE_C[1]) / (FACE_RZ + 0.03)) ** 2 < 1
    for v in e.verts)]
nbr = {}
for e in rim_edges:
    a, b = e.verts
    nbr.setdefault(a, []).append(b)
    nbr.setdefault(b, []).append(a)
loops, used = [], set()
for start in nbr:
    if start in used:
        continue
    lp, prev, cur = [start], None, start
    used.add(start)
    while True:
        nxt = [w for w in nbr[cur] if w is not prev]
        if not nxt or nxt[0] is start or nxt[0] in used:
            break
        prev, cur = cur, nxt[0]
        lp.append(cur)
        used.add(cur)
    loops.append(lp)
loop = max(loops, key=len)  # (a deep sculpted mouth leaves a second, inner loop: capped below, out of sight)
print(f"face rim: {len(rim_edges)} boundary edges in {len(loops)} loops; main loop {len(loop)} verts")
rim2d = np.array([(v.co.x, v.co.z) for v in loop])
poly = Poly(rim2d)
h = 0.0035
pts = []
zs = np.arange(rim2d[:, 1].min(), rim2d[:, 1].max(), h * np.sqrt(3) / 2)
for j, zz in enumerate(zs):
    xs = np.arange(rim2d[:, 0].min() + (h / 2 if j % 2 else 0), rim2d[:, 0].max(), h)
    pts += [(xx, zz) for xx in xs]
pts = np.array(pts)
seg_d = np.full(len(pts), 9.0)
for a, b in zip(rim2d, np.roll(rim2d, -1, axis=0)):
    ab = b - a
    t = np.clip(((pts - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    seg_d = np.minimum(seg_d, np.linalg.norm(pts - (a + t[:, None] * ab), axis=1))
pts = pts[poly.contains_points(pts) & (seg_d > 0.6 * h)]
all2d = np.vstack([rim2d, pts])
tri = Delaunay(all2d).simplices
tri = tri[poly.contains_points(all2d[tri].mean(1))]
y0 = np.mean([v.co.y for v in loop])
new_verts = [bm.verts.new((px_, y0, pz_)) for px_, pz_ in pts]
ring = loop + new_verts
for a, b, c in tri:
    va, vb, vc = ring[a], ring[b], ring[c]
    nn = (vb.co - va.co).cross(vc.co - va.co)
    try:
        bm.faces.new((va, vb, vc) if nn.y < 0 else (va, vc, vb))  # front faces point -Y
    except ValueError:
        pass
# Delaunay skips a few slivers along the concave parts of the rim: close them
gaps = [e for e in bm.edges if e.is_boundary and all(
    v.co.y < -0.10 and ((v.co.x - FACE_C[0]) / (FACE_RX + 0.03)) ** 2 + ((v.co.z - FACE_C[1]) / (FACE_RZ + 0.03)) ** 2 < 1
    for v in e.verts)]
res = bmesh.ops.holes_fill(bm, edges=gaps, sides=0)
bmesh.ops.triangulate(bm, faces=res["faces"])
print(f"face rim gaps closed: {len(res['faces'])} ({len(gaps)} open edges)")
bm.verts.index_update()
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
mask = np.zeros(len(bm.verts), bool)
mask[[v.index for v in new_verts]] = True
tmp = tempfile.mkdtemp()
np.savez(f"{tmp}/in.npz", co=coords(), tris=tris_of(bm), mask=mask)
print(subprocess.run(["python3", "-I", os.path.join(HERE, "..", "fill.py"), f"{tmp}/in.npz", f"{tmp}/out.npz", "1"],
                     check=True, capture_output=True, text=True).stdout.strip())
new = np.load(f"{tmp}/out.npz")["co"]
for v in new_verts:
    v.co.y = new[v.index][1]
    v[blay] = 0.0
print(f"face patch: {len(new_verts)} new verts, {len(tri)} triangles")

# ---------------------------------------------------------------- head: iron out sculpted seams
# Tripo sculpted a piping seam over the crown and down the back of the seated head (and a crease down the back of the
# standing one): tight folds of tiny faces that fairing alone only softens. Find their sharp edges, take a ~1 cm band
# round them and relax it flush with the head.
bm.normal_update()
sharp = set()
for e in bm.edges:
    if len(e.link_faces) == 2 and min(v.co.z for v in e.verts) > Z_NECK + 0.04 \
            and e.calc_face_angle(0) > np.radians(18):
        sharp.update(e.verts)
band = set(sharp)
for _ in range(3):
    band |= {w for v in band for e in v.link_edges for w in e.verts}
band = [v for v in band if v.co.z > Z_NECK + 0.03]
for _ in range(40):
    bmesh.ops.smooth_vert(bm, verts=band, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.normal_update()
print(f"head seam: {len(sharp)} sharp-edge verts, band of {len(band)} relaxed")

# ---------------------------------------------------------------- smooth the glossy head (implicit fairing)
# The tooth is glossy, so every decimation facet and scan ripple shows in the highlights. Cotangent-Laplacian
# implicit fairing (area-weighted, Desbrun et al. 1999) melts centimetre-scale ripples and keeps the big curves.
# The collar join stays put.
import scipy.sparse as sp  # noqa: E402
from scipy.sparse.linalg import spsolve  # noqa: E402

HEAD_FIXED_Z, HEAD_FAIR_STEPS = Z_NECK + 0.02, 3
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.verts.index_update()
pos = coords()
F = tris_of(bm)
n_v = len(pos)


def cot_laplacian(P, tris=None):
    F = globals()["F"] if tris is None else tris
    n_v = len(P)
    v0, v1, v2 = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]

    def cot(a, b):
        return np.clip(np.einsum("ij,ij->i", a, b) / np.maximum(np.linalg.norm(np.cross(a, b), axis=1), 1e-12), 0, 10)

    c0, c1, c2 = cot(v1 - v0, v2 - v0), cot(v2 - v1, v0 - v1), cot(v0 - v2, v1 - v2)
    rows = np.concatenate([F[:, 1], F[:, 2], F[:, 2], F[:, 0], F[:, 0], F[:, 1]])
    cols = np.concatenate([F[:, 2], F[:, 1], F[:, 0], F[:, 2], F[:, 1], F[:, 0]])
    Wl = sp.coo_matrix((0.5 * np.concatenate([c0, c0, c1, c1, c2, c2]), (rows, cols)), shape=(n_v, n_v)).tocsr()
    area = 0.5 * np.linalg.norm(np.cross(v1 - v0, v2 - v0), axis=1)
    mass = np.bincount(F.ravel(), weights=np.repeat(area / 3, 3), minlength=n_v)
    return Wl - sp.diags(np.asarray(Wl.sum(1)).ravel()), mass


free = pos[:, 2] > HEAD_FIXED_Z
for _ in range(HEAD_FAIR_STEPS):
    L, mass = cot_laplacian(pos)
    fr = (free & (mass > 0)).astype(float)
    A = (sp.diags(fr) @ (sp.diags(mass) - (HEAD_FAIR_T / HEAD_FAIR_STEPS) * L) + sp.diags(1 - fr)).tocsc()
    pos = np.column_stack([spsolve(A, np.where(fr > 0, mass, 1.0) * pos[:, k]) for k in range(3)])
# the old face plate leaves soft lumps around the eyes and cheeks: fair the front of the head harder, fading out
# smoothly toward the sides (per-vertex time step, so there is no fixed seam)
r = np.sqrt((pos[:, 0] / 0.30) ** 2 + ((pos[:, 2] - FRONT_Z) / 0.22) ** 2)


kf = (1 - _smooth01(r, 0.7, 1.0)) * _smooth01(-pos[:, 1], 0.02, 0.10) * (pos[:, 2] > HEAD_FIXED_Z + 0.02)
for _ in range(3):
    L, mass = cot_laplacian(pos)
    A = (sp.diags(np.maximum(mass, 1e-12)) - sp.diags(kf * FRONT_FAIR_T / 3) @ L).tocsc()
    pos = np.column_stack([spsolve(A, np.maximum(mass, 1e-12) * pos[:, k]) for k in range(3)])
for v, p_ in zip(bm.verts, pos):
    v.co = p_
bm.normal_update()
print(f"head smoothed: {int(free.sum())} verts, face front {int((kf > 0.01).sum())}")

# ---------------------------------------------------------------- head: straight and symmetric
# Tripo turned the seated head ~14 deg to the side, and neither head is quite symmetric, so the face kit (centred on
# x=0) sat off the head's own centre line. Fit the head's mirror plane (yaw, roll, sideways shift) and turn the head
# about the neck so that plane is x=0 (its forward lean stays: part of the look); then mirror-average the head so both
# halves match. The neck blends over 4 cm.
from scipy.spatial import cKDTree  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

co = coords()
wz = _smooth01(co[:, 2], Z_NECK - 0.005, Z_NECK + 0.035)     # 0 on the body .. 1 on the head
Hd = co[wz > 0.999]
pivot = np.array([Hd[:, 0].mean(), Hd[:, 1].mean(), Z_NECK])
sample = Hd[np.random.default_rng(0).choice(len(Hd), min(5000, len(Hd)), replace=False)]


def rot_yr(yaw, roll):
    cy, sy, cr, sr = np.cos(yaw), np.sin(yaw), np.cos(roll), np.sin(roll)
    return np.array([[cr, 0, sr], [0, 1, 0], [-sr, 0, cr]]) @ np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])


def asym(yaw, roll, dx):
    P = (sample - pivot) @ rot_yr(yaw, roll).T + pivot + (dx, 0, 0)
    return np.sqrt(np.mean(cKDTree(P).query(P * (-1, 1, 1))[0] ** 2))


best = min(((asym(np.radians(a), np.radians(r), dx), np.radians(a), np.radians(r), dx)
            for a in np.arange(-16, 16.1, 2) for r in np.arange(-6, 6.1, 2) for dx in np.arange(-0.03, 0.031, 0.005)))
err, yaw, roll, dx = best
for da, dd in ((np.radians(0.5), 0.002), (np.radians(0.15), 0.0007)):
    for _ in range(3):
        err, yaw, roll, dx = min((asym(yaw + i * da, roll + j * da, dx + k * dd), yaw + i * da, roll + j * da, dx + k * dd)
                                 for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1))
if SIT:  # the seated head keeps the scan's 14 deg turn, exactly as the glb (user); only measured here
    yaw = roll = dx = 0.0
Rm = rot_yr(yaw, roll)
target = ((co - pivot) @ Rm.T) + pivot + (dx, 0, 0)
co = co + wz[:, None] * (target - co)
for v, p_ in zip(bm.verts, co):
    v.co = p_
print(f"head straightened: yaw {np.degrees(yaw):+.1f}, roll {np.degrees(roll):+.1f}, shift {dx * 1000:+.1f} mm; "
      f"left/right mismatch {asym(0, 0, 0) * 1000:.1f} -> {err * 1000:.1f} mm")
# mirror-average: each head vertex moves halfway to where the mirrored surface says it should be
head_faces = [[v.index for v in f.verts] for f in bm.faces if all(wz[v.index] > 0 for v in f.verts)]
for _ in range(0 if SIT else 4):
    co = coords()
    bvh = BVHTree.FromPolygons([tuple(c) for c in co], head_faces)
    for v in bm.verts:
        w = wz[v.index]
        if w <= 0:
            continue
        loc = bvh.find_nearest(Vector((-v.co.x, v.co.y, v.co.z)))[0]
        if loc is not None:
            v.co = v.co.lerp((v.co + Vector((-loc.x, loc.y, loc.z))) * 0.5, w)
co = coords()
Hs = co[wz > 0.999]
print(f"head mirrored: rms mismatch now {np.sqrt(np.mean(cKDTree(Hs).query(Hs * (-1, 1, 1))[0] ** 2)) * 1000:.1f} mm")
pos = co
for _ in range(2):  # a light fairing pass irons out what the averaging left
    L, mass = cot_laplacian(pos)
    fr = (free & (mass > 0)).astype(float)
    A = (sp.diags(fr) @ (sp.diags(mass) - 2e-5 * L) + sp.diags(1 - fr)).tocsc()
    pos = np.column_stack([spsolve(A, np.where(fr > 0, mass, 1.0) * pos[:, k]) for k in range(3)])
for v, p_ in zip(bm.verts, pos):
    v.co = p_
bm.normal_update()

# ---------------------------------------------------------------- colour edges: cut along the blue field's 0.5 contour
co = coords()
N = len(co)
ei = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])
deg = np.bincount(ei.ravel(), minlength=N).astype(float)
Lb = np.array([v[blay] for v in bm.verts])
Lb[co[:, 2] > Z_NECK] = 0.0
for _ in range(15):  # a little diffusion: the 0.5 contour of this field is the (smooth) colour edge
    acc = np.zeros(N)
    np.add.at(acc, ei[:, 0], Lb[ei[:, 1]])
    np.add.at(acc, ei[:, 1], Lb[ei[:, 0]])
    Lb = 0.5 * Lb + 0.5 * acc / np.maximum(deg, 1)
for v in bm.verts:
    v[blay] = Lb[v.index]


def cut_contour(value, region=None):
    """Split the mesh along value(v) == 0 (edges with a sign change, optionally only inside region(v))."""
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    val = {v: value(v) or 1e-9 for v in bm.verts}
    cross = [e for e in bm.edges if val[e.verts[0]] * val[e.verts[1]] < 0
             and (region is None or (region(e.verts[0]) and region(e.verts[1])))]
    new = set()
    for e in cross:
        a, b = e.verts
        _, nv = bmesh.utils.edge_split(e, a, val[a] / (val[a] - val[b]))
        nv[blay] = 0.5
        new.add(nv)
    for f in list(bm.faces):
        vs = [v for v in f.verts if v in new]
        if len(vs) == 2:
            bmesh.ops.connect_verts(bm, verts=vs)
    return len(new)


print("colour edge cut verts", cut_contour(lambda v: v[blay] - 0.5, lambda v: v.co.z < Z_NECK))
# a cut landing on an edge's end leaves a twin vertex joined by zero-area faces; skinning moves the twins apart
# (thin strips in big poses), so merge them
n0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=2e-5)
bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges[:])
bmesh.ops.triangulate(bm, faces=bm.faces[:])
print("twin verts merged", n0 - len(bm.verts))
bm.verts.index_update()
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
bm.normal_update()


def bad_faces():
    """Faces on non-manifold edges, and faces folded over on the head (the collar has real tight creases)."""
    bad = {f for e in bm.edges if len(e.link_faces) > 2 for f in e.link_faces}
    bm.normal_update()
    for f in bm.faces:
        if f.calc_center_median().z < Z_NECK + 0.02:
            continue
        avg = sum((g.normal for e in f.edges for g in e.link_faces if g is not f), Vector())
        if avg.length > 1e-9 and f.normal.dot(avg.normalized()) < 0:
            bad.add(f)
    return bad


def close_small_holes(bad, grow=0, max_len=60):
    """Cut out `bad` (grown by `grow` rings, so the hole gets a clean rim), then close every small open loop:
    ear-clipped polygons first (a fan round the centroid of a concave hole folds over itself), fans as a fallback."""
    for _ in range(grow):
        bad |= {g for f in bad for v in f.verts for g in v.link_faces}
    bmesh.ops.delete(bm, geom=list(bad), context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context="EDGES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=max_len)
    bmesh.ops.triangulate(bm, faces=res["faces"], quad_method="BEAUTY", ngon_method="BEAUTY")
    fans = 0
    for lp, closed in MF.walk_loops([e for e in bm.edges if e.is_boundary]):  # loops holes_fill refused
        if not closed or len(lp) > max_len:
            continue
        c = bm.verts.new(sum((v.co for v in lp), Vector()) / len(lp))
        c[blay] = sum(v[blay] for v in lp) / len(lp)
        for a, b in zip(lp, lp[1:] + lp[:1]):
            e = bm.edges.get((a, b))
            if e is None or not e.link_faces:
                continue
            f0 = e.link_faces[0]
            loop_a = next(lo for lo in f0.loops if lo.vert is a)
            try:
                bm.faces.new((b, a, c) if loop_a.link_loop_next.vert is b else (a, b, c))
                fans += 1
            except ValueError:
                pass
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    return len(bad), len(res["faces"]), fans


for attempt in range(3):  # a stubborn tangle gets a wider cut each round
    bad = bad_faces()
    if not bad:
        break
    print(f"clean-up round {attempt}: faces cut, holes filled, fan triangles:", close_small_holes(bad, grow=attempt))
# the mesh is closed now, so one consistent winding can be solved for all of it (the planar patches round the
# seated torso came out with mixed winding: dark speckles along their rims)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.normal_update()


def srgb_to_lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_mat(name, rgb, rough, coat=0.0, coat_rough=0.1, spec=0.5, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    lin = [srgb_to_lin(c) for c in rgb]
    p.inputs["Base Color"].default_value = (*lin, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        p.inputs["Emission Color"].default_value = (*lin, 1)
        p.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*lin, 1)
    m.roughness = rough
    return m


MATS = [
    make_mat("Tooth", (253, 253, 255), 0.05, coat=1.0, coat_rough=0.01, spec=0.85, emit=0.18),  # glassy porcelain
    make_mat("Coat", (247, 247, 250), 0.55),
    make_mat("Scrubs", (30, 62, 168), 0.7),
    make_mat("Feet", (250, 250, 253), 0.2, coat=0.8, coat_rough=0.05, spec=0.6, emit=0.08),
]
me.materials.clear()
for m in MATS:
    me.materials.append(m)
TOOTH, COAT, SCRUBS, FEET = range(4)

for f in bm.faces:
    c = f.calc_center_median()
    if c.z > Z_NECK:
        f.material_index = TOOTH
    elif sum(v[blay] for v in f.verts) / len(f.verts) > 0.5:
        f.material_index = SCRUBS
    elif c.z < SHOE_Z:
        f.material_index = FEET
    else:
        f.material_index = COAT


def drop_specks(min_faces=80):
    seen, changed = set(), 0
    for f in bm.faces:
        if f.index in seen:
            continue
        comp, stack = [f], [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for g in e.link_faces:
                    if g.index not in seen and g.material_index == f.material_index:
                        seen.add(g.index)
                        comp.append(g)
                        stack.append(g)
        if len(comp) >= min_faces or f.material_index == TOOTH:
            continue
        cset = {g.index for g in comp}
        around = [g.material_index for c in comp for e in c.edges for g in e.link_faces if g.index not in cset]
        if around:
            m = max(set(around), key=around.count)
            for c in comp:
                c.material_index = m
            changed += len(comp)
    return changed


bm.faces.ensure_lookup_table()
for _ in range(2):
    print("speck faces reassigned", drop_specks(60))

if SIT:  # small white islands (socks, the mudra hands, the neck inside the V) are glossy like the tooth
    seen = set()
    for f in bm.faces:
        if f.material_index != COAT or f.index in seen:
            continue
        comp, stack = [f], [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for g in e.link_faces:
                    if g.index not in seen and g.material_index == COAT:
                        seen.add(g.index)
                        comp.append(g)
                        stack.append(g)
        if len(comp) < 8000:
            for g in comp:
                g.material_index = FEET
            print(f"white island -> glossy: {len(comp)} faces at {tuple(round(a, 2) for a in comp[0].calc_center_median())}")

print("open edges", sum(e.is_boundary for e in bm.edges), "non-manifold", sum(len(e.link_faces) > 2 for e in bm.edges))
# ---------------------------------------------------------------- seated head: its own clean surface, the scan's shape
# The scanned head still shades with faint ripples in a glossy material (decimated scan + face patch). It becomes its
# own object, keeping the scan's shape: cut off at the neck and capped, voxel-remeshed into an even surface, faired
# gently and decimated symmetrically. The body's neck is capped too (hidden inside the head).
def fair(P, tris, t, steps):
    for _ in range(steps):
        L, mass = cot_laplacian(P, tris)
        A = (sp.diags(np.maximum(mass, 1e-12)) - (t / steps) * L).tocsc()
        P = np.column_stack([spsolve(A, np.maximum(mass, 1e-12) * P[:, k]) for k in range(3)])
    return P


# The scan's open mouth (sculpted into the face, flattened with the rest of the face above) comes back as a pocket
# carved into the head in its exact smile outline (measured on the scan's painted face once the head is straight and
# centred): the surface rebuild below rounds its rim like sculpted lips, and faces deeper than the skin get the dark
# lining. rig_tripo adds the 3D tongue and the lid that closes it, using the uncarved twin "HeadSurface".
MOUTH_HW, MOUTH_TOP, MOUTH_CORNER, MOUTH_DROP, MOUTH_DEPTH = 0.0455, 0.0705, 0.078, 0.039, 0.016
FACE_CX = 0.027  # the scan's painted face centre on its turned head (measured on the glb's texture, front view)


from matplotlib.path import Path as Poly  # noqa: E402


def mouth_outline():
    xs = np.linspace(-MOUTH_HW, MOUTH_HW, 25)
    top = [(FACE_CX + x, MOUTH_TOP + (MOUTH_CORNER - MOUTH_TOP) * (x / MOUTH_HW) ** 2) for x in xs]
    return top + [(FACE_CX + MOUTH_HW * np.cos(a), MOUTH_CORNER - MOUTH_DROP * np.sin(a))
                  for a in np.linspace(0, np.pi, 25)[1:-1]]


def front_y(bvh, x, z):
    return bvh.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))[0].y


def mouth_cutter(bvh, bowl):
    """Closed mesh: the outline run straight back along +y through the skin, then (bowl) rounding off MOUTH_DEPTH deep."""
    ol = mouth_outline()
    ys = np.array([front_y(bvh, x, z) for x, z in ol])
    cz, y_end = float(np.mean([z for _, z in ol])), ys.max() + 0.006
    b = bmesh.new()
    rings = [[b.verts.new((x, y - 0.02, z)) for (x, z), y in zip(ol, ys)],
             [b.verts.new((x, y + 0.006, z)) for (x, z), y in zip(ol, ys)]]
    if bowl:
        for th in np.linspace(0, np.pi / 2, 7)[1:-1]:
            k, d = np.cos(th), MOUTH_DEPTH * np.sin(th)
            rings.append([b.verts.new((x * k, y_end + d, cz + (z - cz) * k)) for x, z in ol])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for i in range(len(ol)):
            b.faces.new((r0[i], r0[i - 1], r1[i - 1], r1[i]))
    front = b.verts.new((0.0, ys.min() - 0.02, cz))
    back = b.verts.new((0.0, (y_end + MOUTH_DEPTH) if bowl else (ys.max() + 0.006), cz))
    for i in range(len(ol)):
        b.faces.new((rings[0][i - 1], rings[0][i], front))
        b.faces.new((rings[-1][i], rings[-1][i - 1], back))
    bmesh.ops.recalc_face_normals(b, faces=b.faces[:])
    return b


def as_object(name, b):
    m_ = bpy.data.meshes.new(name)
    b.to_mesh(m_)
    b.free()
    o = bpy.data.objects.new(name, m_)
    bpy.context.scene.collection.objects.link(o)
    return o


def apply_mod(obj, md):
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=md.name)


def rebuild_head(obj, carve=None):
    """The scan's head surface as is (carve: cut the mouth pocket into it and round its lips), the cap's rim softened,
    faired very lightly, and the few folded triangles relaxed."""
    hme = obj.data
    # a fine even surface (2.5 mm voxels: the scan's shape within a millimetre); the mouth is cut into it and the
    # surface rebuilt once more, which rounds the cut's rim into soft lips
    for step in range(2 if carve else 1):
        if step:
            bl = obj.modifiers.new("mouth", "BOOLEAN")
            bl.operation, bl.object, bl.solver = "DIFFERENCE", carve, "EXACT"
            apply_mod(obj, bl)
        rm = obj.modifiers.new("remesh", "REMESH")
        rm.mode, rm.voxel_size = "VOXEL", 0.0025
        apply_mod(obj, rm)
    tb = bmesh.new()
    tb.from_mesh(hme)
    bmesh.ops.triangulate(tb, faces=tb.faces[:])
    tb.to_mesh(hme)
    tb.free()
    # the lower head stays exactly the scan's (its chin runs on down into the collar)
    sb = bmesh.new()
    sb.from_mesh(hme)
    ol = np.array(mouth_outline())
    lips = Poly((ol - ol.mean(0)) * 1.25 + ol.mean(0))
    mouth_v = [v for v in sb.verts if v.co.y < -0.1 and lips.contains_point((v.co.x, v.co.z))]
    for _ in range(6):  # round, smooth lips
        bmesh.ops.smooth_vert(sb, verts=mouth_v, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    sb.to_mesh(hme)
    sb.free()
    HP = np.array([v.co[:] for v in hme.vertices])
    HT = np.array([p.vertices[:] for p in hme.polygons])
    HP = fair(HP, HT, 1e-5, 2)                              # only the voxel steps
    for v, p_ in zip(hme.vertices, HP):
        v.co = p_
    keep = obj.vertex_groups.new(name="decimate")  # light enough for the web; the mouth keeps its full detail
    keep.add([v.index for v in hme.vertices if not (v.co.y < -0.1 and lips.contains_point((v.co.x, v.co.z)))], 1.0, "REPLACE")
    dm = obj.modifiers.new("dec", "DECIMATE")
    dm.ratio, dm.vertex_group = 50000 / len(hme.polygons), "decimate"
    apply_mod(obj, dm)
    rb = bmesh.new()
    rb.from_mesh(hme)
    for _ in range(4):
        rb.normal_update()
        spots = set()
        for f in rb.faces:
            nb = [g for e in f.edges for g in e.link_faces if g is not f]
            avg = sum((g.normal for g in nb), Vector())
            if avg.length > 1e-9 and f.normal.dot(avg.normalized()) < 0.3:
                spots |= {w for v in f.verts for e in v.link_edges for w in e.verts}
        if not spots:
            break
        for _ in range(3):
            bmesh.ops.smooth_vert(rb, verts=list(spots), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    rb.to_mesh(hme)
    rb.free()
    for p in hme.polygons:
        p.use_smooth = True


if SIT:
    # the head takes the scan's curved under-chin too (the neck down to z -0.022), so its own surface rounds in
    # under the chin and it closes at the narrow neck, not at its wide bottom rim (that cap edge showed as a line)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.material_index != TOOTH and c.z > -0.022 and abs(c.x) < 0.2:
            f.material_index = TOOTH
    hb = bm.copy()
    bmesh.ops.delete(hb, geom=[f for f in hb.faces if f.material_index != TOOTH], context="FACES")
    # the voxel remesh needs a closed surface: drop faces on non-manifold edges, then close every hole
    bmesh.ops.delete(hb, geom=list({f for e in hb.edges if len(e.link_faces) > 2 for f in e.link_faces}), context="FACES")
    bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context="VERTS")
    bmesh.ops.holes_fill(hb, edges=[e for e in hb.edges if e.is_boundary], sides=0)
    rim = [e for e in hb.edges if e.is_boundary]  # a loop touching itself (bowtie) is refused: fan it to its centre
    if rim:
        c = hb.verts.new(sum((v.co for e in rim for v in e.verts), Vector()) / (2 * len(rim)))
        for e in rim:
            a, b = e.verts
            la = next(lo for lo in e.link_faces[0].loops if lo.vert is a)
            hb.faces.new((b, a, c) if la.link_loop_next.vert is b else (a, b, c))
    print(f"head piece: {len(hb.faces)} faces, open edges {sum(e.is_boundary for e in hb.edges)}")
    bvh_piece = BVHTree.FromBMesh(hb)
    yc = YC = float(np.mean([v.co.y for v in hb.verts]))
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == TOOTH], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    cap = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)["faces"]
    bmesh.ops.triangulate(bm, faces=cap)
    for f in bm.faces:
        if f.material_index == TOOTH:  # the neck cap
            f.material_index = FEET
    # the body's top (the scan head's underside lip round the neck) stays tucked inside the head, its ragged edge
    # smoothed into a plain neck ring
    for v in bm.verts:
        k = float(_smooth01(np.array(v.co.z), -0.045, -0.02))
        if k > 0:
            v.co.x *= 1 - 0.03 * k  # the scan's own neck ring, tucked up just inside the head's underside:
            v.co.y = yc + (v.co.y - yc) * (1 - 0.03 * k)  # head and collar meet with no seam showing
            v.co.z += 0.006 * k
    band = [v for v in bm.verts if v.co.z > -0.035]
    for _ in range(12):
        bmesh.ops.smooth_vert(bm, verts=band, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    surface = as_object("HeadSurface", hb.copy())        # uncarved twin: rig places the face kit and the lid on it
    head = as_object("Head", hb)
    pocket = as_object("MouthPocket", mouth_cutter(bvh_piece, True))
    rebuild_head(head, pocket)
    rebuild_head(surface)
    bpy.data.objects.remove(pocket)
    hme = head.data
    hme.materials.append(MATS[TOOTH])
    hme.materials.append(bpy.data.materials.get("MouthInside") or make_mat("MouthInside", (70, 16, 26), 0.45))
    sb = bmesh.new()
    sb.from_mesh(surface.data)
    bvh_skin = BVHTree.FromBMesh(sb)
    sb.free()
    from matplotlib.path import Path as Poly  # noqa: E402
    ol = np.array(mouth_outline())
    inside = Poly((ol - ol.mean(0)) * 0.93 + ol.mean(0))  # a little inside the opening: clean corners
    lined = 0
    for p in hme.polygons:
        c = p.center
        if inside.contains_point((c.x, c.z)) and \
                front_y(bvh_skin, c.x, c.z) + 0.0035 < c.y < front_y(bvh_skin, c.x, c.z) + MOUTH_DEPTH + 0.012:
            p.material_index = 1
            lined += 1
    surface.hide_render = True
    print(f"head rebuilt: {len(hme.polygons)} tris, mouth pocket lined with {lined} faces")

bm.to_mesh(me)
bm.free()
print("mesh validate fixed problems:", me.validate(verbose=False))
me.update()
for p in me.polygons:
    p.use_smooth = True
for o in bpy.context.scene.objects:
    o.select_set(o == body)
bpy.context.view_layer.objects.active = body
print("verts", len(me.vertices), "tris", len(me.polygons))
out = os.path.join(OUT_DIR, "prep.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("saved", out)
