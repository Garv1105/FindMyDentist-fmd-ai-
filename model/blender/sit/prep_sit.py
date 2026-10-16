"""Seated mascot, step 1: clean the Meshy mesh, fill the sculpted face, cut off the lumpy hands, paint materials.

blender -b --factory-startup --python prep_sit.py -- <src.glb> <ref.png> <register.json> <out.blend>

Measured on the seated export (8d14…glb, 1 unit tall, origin at the bbox centre, -Y = front):
  forearm (left) runs from (0.262, 0.060, -0.235) toward (0.37, -0.27, -0.25); the sleeve cuff ends 0.185 along it,
  sculpted closed eyes at x≈-0.13/+0.15, z≈0.146; sculpted smile at x≈0.006, z≈0.065–0.085.
"""
import bpy, bmesh, sys, os, json, heapq, subprocess, tempfile
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, REF_PNG, REG_JSON, OUT_BLEND = argv
reg = json.load(open(REG_JSON))
HERE = os.path.dirname(__file__)

DECIMATE = 0.2           # ~40% of the body's result is hidden inner shell that gets removed afterwards
Z_NECK = 0.0             # above: tooth head (the head's underside sits at z≈0.01 over the collar)
ARM_P0 = np.array([0.262, 0.060, -0.235])
ARM_P1 = np.array([0.370, -0.270, -0.250])
CUFF_T = 0.185
WHITE, BLUE, UNK = 0, 1, -1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
body = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
body.name = body.data.name = "Mascot"
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()


def coords():
    return np.array([v.co[:] for v in bm.verts])


def tris_of(b):
    return np.array([[v.index for v in f.verts] for f in b.faces if len(f.verts) == 3])


# ---------------------------------------------------------------- cut off the hands (replaced by rigged gloves)
co = coords()
cut = []
for sx in (1, -1):
    p0, p1 = ARM_P0 * [sx, 1, 1], ARM_P1 * [sx, 1, 1]
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    rel = co - p0
    t = rel @ d
    r = np.linalg.norm(rel - np.outer(t, d), axis=1)
    cand = (t > CUFF_T) & (r < 0.13) & (co[:, 2] > p0[2] - 0.065)
    seed = int(np.argmax(np.where(cand & (r < 0.06), t, -9)))
    seen = {seed}
    stack = [bm.verts[seed]]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            o = e.other_vert(v)
            if o.index not in seen and cand[o.index]:
                seen.add(o.index)
                stack.append(o)
    hand = np.array(sorted(seen))
    # leftover islands inside the hand's box (finger tips Meshy left unconnected) go too
    lo, hi = co[hand].min(0) - 0.01, co[hand].max(0) + 0.01
    rest = cand & ~np.isin(np.arange(len(co)), hand) & np.all((co > lo) & (co < hi), axis=1)
    frag = []
    left = set(np.nonzero(rest)[0].tolist())
    while left:
        st = left.pop()
        comp, stack = [st], [bm.verts[st]]
        while stack:
            v = stack.pop()
            for e in v.link_edges:
                o = e.other_vert(v)
                if o.index in left:
                    left.discard(o.index)
                    comp.append(o.index)
                    stack.append(o)
        if len(comp) < 2000:
            frag += comp
    print(f"hand {'L' if sx > 0 else 'R'}: candidates {cand.sum()}, flood-filled {len(hand)}, fragments {len(frag)}, "
          f"bbox {co[hand].min(0).round(3)} {co[hand].max(0).round(3)}")
    cut += [bm.verts[i] for i in list(hand) + frag]
bmesh.ops.delete(bm, geom=cut, context="VERTS")
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# ---------------------------------------------------------------- face: rebuild the patch over the sculpted face
# The closed eyes are deep slits; flattening them in place folds the slit walls onto each other (a double layer
# with opposite normals renders as black spots). So the whole patch is deleted and re-triangulated as a height
# field seen from the front (fresh even grid), and only its depth is solved, matching the surrounding head.
from scipy.spatial import Delaunay
from matplotlib.path import Path as Poly

co = coords()
x, y, z = co.T
face = (y < -0.05) & ((x / 0.27) ** 2 + ((z - 0.14) / 0.095) ** 2 < 1)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(face[v.index] for v in f.verts)], context="FACES_ONLY")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.verts.ensure_lookup_table()
# the hole's rim: boundary edges near the face, walked into one loop
rim_edges = [e for e in bm.edges if e.is_boundary and all(
    v.co.y < -0.03 and (v.co.x / 0.30) ** 2 + ((v.co.z - 0.14) / 0.125) ** 2 < 1 for v in e.verts)]
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
# the head also has a hidden inner layer behind the face (its hole is invisible): rebuild the front-most rim
loop = min(loops, key=lambda lp: np.mean([v.co.y for v in lp]) if len(lp) > 50 else 9)
print(f"face rim: {len(rim_edges)} boundary edges in {len(loops)} loops; front loop {len(loop)} verts, "
      f"mean y {np.mean([v.co.y for v in loop]):.3f}")
rim2d = np.array([(v.co.x, v.co.z) for v in loop])
poly = Poly(rim2d)
h = 0.004
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
cent = all2d[tri].mean(1)
tri = tri[poly.contains_points(cent)]
y0 = np.mean([v.co.y for v in loop])
new_verts = [bm.verts.new((px_, y0, pz_)) for px_, pz_ in pts]
ring = loop + new_verts
for a, b, c in tri:
    va, vb, vc = ring[a], ring[b], ring[c]
    n = (vb.co - va.co).cross(vc.co - va.co)
    try:
        bm.faces.new((va, vb, vc) if n.y < 0 else (va, vc, vb))  # front faces point -Y
    except ValueError:
        pass
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
print(f"face patch: {len(new_verts)} new verts, {len(tri)} triangles")

head_verts = [v for v in bm.verts if v.co.z > 0.03]
for _ in range(25):  # Meshy surface noise on the glossy head
    bmesh.ops.smooth_vert(bm, verts=head_verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(body.data)
bm.free()

# ---------------------------------------------------------------- decimate + remove the hidden inner shell
mod = body.modifiers.new("dec", "DECIMATE")
mod.ratio = DECIMATE
bpy.ops.object.modifier_apply(modifier=mod.name)
me = body.data
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.normal_update()
rng = np.random.default_rng(0)
dirs = rng.normal(size=(48, 3))
dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
bvh_all = BVHTree.FromBMesh(bm)
interior = []
for f in bm.faces:
    if f.calc_center_median().z > -0.03:
        continue  # head: rigid, so a leftover inner layer can't tear; the test misfires under the chin
    n = f.normal
    p = f.calc_center_median() + n * 1e-3
    first = bvh_all.ray_cast(p, n)
    if first[0] is None or first[3] < 0.03:
        continue
    if all(bvh_all.ray_cast(p, Vector(d) if Vector(d).dot(n) > 0 else -Vector(d))[0] is not None for d in dirs):
        interior.append(f)
print(f"interior faces removed: {len(interior)} of {len(bm.faces)}")
bmesh.ops.delete(bm, geom=interior, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
edges_open = [e for e in bm.edges if e.is_boundary]
filled = bmesh.ops.holes_fill(bm, edges=edges_open, sides=12)
bmesh.ops.triangulate(bm, faces=filled["faces"])
print(f"open boundary edges: {len(edges_open)}, small holes closed: {len(filled['faces'])}")
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
bm.normal_update()
print("verts", len(bm.verts), "tris", len(bm.faces))

# ---------------------------------------------------------------- remove Meshy's arms (rig_sit builds clean sleeves)
# The scanned sleeves are fused into the torso side, coat flap and knees, so they can't move without tearing.
# Delete them (the sleeve tube around the measured arm axes, minus surfaces facing the arm) and close each torso
# side with a smooth patch; the procedural sleeve's ball shoulder then sits in a closed body.
sys.path.insert(0, HERE)
import meshfix as MF  # noqa: E402

SHOULDER = np.array((0.150, 0.100, -0.065))
ELBOW = np.array((0.243, 0.117, -0.232))
WRIST_P = np.array((0.2932, -0.1221, -0.2464)) + 0.004 * np.array((0.314, -0.948, -0.044))
co = coords()
nrm = np.array([v.normal[:] for v in bm.verts])


def seg(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    c = a + t[:, None] * ab
    return t, np.linalg.norm(p - c, axis=1), c


cand = np.zeros(len(co), bool)
near_arm = np.zeros(len(co), bool)
for sx in (1, -1):
    m = np.array((sx, 1, 1))
    sh, el, wr = SHOULDER * m, ELBOW * m, WRIST_P * m
    t_up, d_up, c_up = seg(co, sh, el)
    t_fo, d_fo, c_fo = seg(co, el, wr)
    c = np.where((d_up < d_fo)[:, None], c_up, c_fo)
    d = np.minimum(d_up, d_fo)
    facing = (nrm * (c - co)).sum(1) / np.maximum(d, 1e-9)
    side = sx * co[:, 0] > 0.02
    cand |= side & ((d_up < 0.064) | (d_fo < 0.092)) & (facing < 0.25)
    near_arm |= side & (d < 0.13)
dele = np.zeros(len(co), bool)
seen = np.zeros(len(co), bool)
for st in np.nonzero(cand)[0]:  # every candidate piece goes, plus loose scraps hanging near the arms
    if seen[st]:
        continue
    comp, stack = [st], [bm.verts[st]]
    seen[st] = True
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            w = e.other_vert(v)
            if cand[w.index] and not seen[w.index]:
                seen[w.index] = True
                comp.append(w.index)
                stack.append(w)
    dele[comp] = True
# loose scraps (whole connected pieces) lying near an arm
lab = -np.ones(len(co), int)
nl = 0
for st in range(len(co)):
    if lab[st] >= 0:
        continue
    lab[st] = nl
    stack = [bm.verts[st]]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            w = e.other_vert(v)
            if lab[w.index] < 0:
                lab[w.index] = nl
                stack.append(w)
    nl += 1
sizes = np.bincount(lab)
for k in range(nl):
    mk = lab == k
    if sizes[k] < 400 and near_arm[mk].mean() > 0.5:
        dele |= mk
rim = set()
for i in np.nonzero(dele)[0]:
    for e in bm.verts[i].link_edges:
        w = e.other_vert(bm.verts[i])
        if not dele[w.index]:
            rim.add(w)
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(dele)[0]], context="VERTS")
rim = {v for v in rim if v.is_valid}
loops = MF.walk_loops([e for e in bm.edges if e.is_boundary and all(v in rim for v in e.verts)])
print(f"arms removed: {dele.sum()} verts; rim loops {[(len(lp), cl) for lp, cl in loops]}")
patch_verts = []
for lp, closed in loops:
    if not closed or len(lp) < 3:
        continue
    out = Vector()
    for i in range(len(lp)):
        e = bm.edges.get((lp[i], lp[(i + 1) % len(lp)]))
        if e and e.link_faces:
            out += e.link_faces[0].normal
    if len(lp) > 40:
        nv, made = MF.fill_planar(bm, lp, 0.0055, out)
        patch_verts += nv
        print(f"  side patch: loop {len(lp)}, {len(nv)} new verts, {made} faces")
print(MF.smooth_patch(bm, patch_verts))
# every short open loop anywhere (small holes from the arm removal and the inner-shell clean-up)
res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=40)
bmesh.ops.triangulate(bm, faces=res["faces"])
fans = 0
for lp, closed in MF.walk_loops([e for e in bm.edges if e.is_boundary]):  # loops holes_fill refused
    if closed and 3 <= len(lp) <= 40:
        c = bm.verts.new(sum((v.co for v in lp), Vector()) / len(lp))
        for a, b in zip(lp, lp[1:] + lp[:1]):
            e = bm.edges.get((a, b))
            if e is None or not e.link_faces:
                continue
            f0 = e.link_faces[0]  # match the neighbour's winding: it walks a->b the other way round
            loop_a = next(lo for lo in f0.loops if lo.vert is a)
            try:
                bm.faces.new((b, a, c) if loop_a.link_loop_next.vert is b else (a, b, c))
                fans += 1
            except ValueError:
                pass
print(f"small holes closed: {len(res['faces'])} + {fans} fan triangles")
# smooth the band around the arm seams: the scan's coat edges there are folded into thin dark creases
seam = {v for v in rim if v.is_valid}
for _ in range(2):
    seam |= {w for v in seam for e in v.link_edges for w in e.verts}
for _ in range(6):
    bmesh.ops.smooth_vert(bm, verts=list(seam), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
print(f"seam band smoothed: {len(seam)} verts")
# (no recalc_face_normals here: on an open mesh it orients each island separately and flips some inward;
#  the patches are oriented explicitly and the rest kept the orientation solved on the closed mesh)
bm.verts.index_update()
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
bm.normal_update()
print("verts", len(bm.verts), "tris", len(bm.faces))

# ---------------------------------------------------------------- colour labels from the reference
co = coords()
nrm = np.array([v.normal[:] for v in bm.verts])
N = len(co)
bvh = BVHTree.FromBMesh(bm)
img = bpy.data.images.load(REF_PNG)
W, H = img.size
px = np.array(img.pixels[:]).reshape(H, W, 4)[::-1]
pu = np.clip(np.round(reg["ax"] * co[:, 0] + reg["bx"]).astype(int), 0, W - 1)
pv = np.clip(np.round(reg["az"] * co[:, 2] + reg["bz"]).astype(int), 0, H - 1)
s = px[pv, pu] * 255
r_, g_, b_, a_ = s.T
lum = s[:, :3].mean(1)
label = np.full(N, WHITE)
sat = (s[:, :3].max(1) - s[:, :3].min(1)) / np.maximum(s[:, :3].max(1), 1)
label[(sat >= 0.6) & (b_ > 100) & (r_ < 110)] = BLUE  # rim glow tints white coat light blue: sat < 0.5, R > 160
label[(a_ < 128) | (lum < 70)] = UNK
visible = np.array([bvh.ray_cast(Vector(c) + Vector((0, -6e-4, 0)), Vector((0, -1, 0)))[0] is None for c in co])
confident = visible & (nrm[:, 1] < -0.35) & (label != UNK)
label[co[:, 2] > Z_NECK] = WHITE
confident |= co[:, 2] > Z_NECK

adj = [[] for _ in range(N)]
for e in bm.edges:
    i, j = e.verts[0].index, e.verts[1].index
    w = e.calc_length()
    adj[i].append((j, w))
    adj[j].append((i, w))
dist = np.full(N, np.inf)
heap = [(0.0, int(i)) for i in np.nonzero(confident)[0]]
for _, i in heap:
    dist[i] = 0
heapq.heapify(heap)
while heap:
    d0, i = heapq.heappop(heap)
    if d0 > dist[i]:
        continue
    for j, w in adj[i]:
        if d0 + w < dist[j]:
            dist[j] = d0 + w
            label[j] = label[i]
            heapq.heappush(heap, (d0 + w, j))
label[label == UNK] = WHITE
for _ in range(3):
    new = label.copy()
    for i in range(N):
        votes = [label[j] for j, _ in adj[i]] + [label[i]]
        new[i] = max(set(votes), key=votes.count)
    label = new
# clean colour edges: diffuse the blue/white field over the surface and re-threshold (removes the zig-zags)
ei = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])
Lb = (label == BLUE).astype(float)
deg = np.bincount(ei.ravel(), minlength=N).astype(float)
for _ in range(30):
    acc = np.zeros(N)
    np.add.at(acc, ei[:, 0], Lb[ei[:, 1]])
    np.add.at(acc, ei[:, 1], Lb[ei[:, 0]])
    Lb = 0.5 * Lb + 0.5 * acc / np.maximum(deg, 1)
label = np.where(Lb > 0.5, BLUE, WHITE)
label[co[:, 2] > Z_NECK] = WHITE
# The lap is shaped differently from the drawing, so it's coloured from its geometry (front depth map):
# blue pants over the knees, crossed shins and the shirt recess between them; white only on the two feet
# that poke out at the bottom (x≈-0.075 / +0.07, z≈-0.48).
x_, y_, z_ = co.T
pants = (((z_ < -0.30) & (np.abs(x_) < 0.25)) | ((z_ < -0.24) & (np.abs(x_) < 0.12))) & (y_ < 0.10)
is_foot = (z_ < -0.452) & (y_ < -0.20) & ((np.abs(x_ + 0.075) < 0.055) | (np.abs(x_ - 0.07) < 0.055))
label[pants] = BLUE
label[is_foot] = WHITE
# V-neck (measured on mascot.png, re-centred): apex z=-0.128, sides rising 1.25 per unit x; inside is the white
# body, around it the blue shirt up to the coat lapels. (The chest sits back under the big head: front y≈+0.03.)
upper_front = (y_ < 0.12) & (z_ > -0.16) & (z_ < Z_NECK) & (np.abs(x_) < 0.08)
is_neck = upper_front & (z_ > -0.128 + 1.25 * np.abs(x_))
label[upper_front & ~is_neck] = BLUE
label[is_neck] = WHITE
print("labels: blue", int((label == BLUE).sum()), "white", int((label == WHITE).sum()), "feet", int(is_foot.sum()))


def srgb_to_lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_mat(name, rgb, rough, coat=0.0, coat_rough=0.1, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    lin = [srgb_to_lin(c) for c in rgb]
    p.inputs["Base Color"].default_value = (*lin, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    m.diffuse_color = (*lin, 1)
    m.roughness = rough
    return m


MATS = [
    make_mat("Tooth", (248, 246, 250), 0.2, coat=0.7, coat_rough=0.06),
    make_mat("Coat", (247, 247, 250), 0.55),
    make_mat("Scrubs", (16, 64, 196), 0.7),
    make_mat("Feet", (248, 246, 250), 0.28, coat=0.5, coat_rough=0.1),
]
for m in MATS:
    me.materials.append(m)
TOOTH, COAT, SCRUBS, FEET = range(4)

for f in bm.faces:
    ids = [v.index for v in f.verts]
    c = sum((co[i] for i in ids), np.zeros(3)) / len(ids)
    blue = sum(label[i] == BLUE for i in ids) * 2 >= len(ids)
    if c[2] > Z_NECK or sum(is_neck[i] for i in ids) * 2 > len(ids):
        f.material_index = TOOTH
    elif sum(is_foot[i] for i in ids) * 2 >= len(ids):
        f.material_index = FEET
    elif blue:
        f.material_index = SCRUBS
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
        if len(comp) >= min_faces:
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
    print("speck faces reassigned", drop_specks())

# The scan sculpted a noisy knit texture into the scrubs; the reference fabric is smooth.
fabric = [v for v in bm.verts if any(f.material_index in (SCRUBS, FEET) for f in v.link_faces)]
for _ in range(14):
    bmesh.ops.smooth_vert(bm, verts=fabric, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
print(f"fabric smoothed: {len(fabric)} verts")

bm.to_mesh(me)
bm.free()
print("mesh validate fixed problems:", me.validate(verbose=False))
me.update()
bpy.ops.object.shade_smooth()
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("saved", OUT_BLEND)
