"""Clean the Meshy mesh, rebuild eyes + smile, and paint materials from the reference PNG.

blender -b --factory-startup --python prep.py -- <src.glb> <ref.png> <register.json> \
        <features.json> <eye.png> <out.blend>
"""
import bpy, bmesh, sys, json, math, heapq
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, REF_PNG, REG_JSON, FEAT_JSON, EYE_PNG, OUT_BLEND = argv
reg = json.load(open(REG_JSON))
feat = json.load(open(FEAT_JSON))

DECIMATE = 0.4      # ~40% of the result is hidden inner shell that gets removed afterwards
Z_HEAD = 0.075      # above this: tooth head
Z_SHOE = -0.405     # below this (and white): shoes
Z_HEM = -0.29       # coat hem
Z_COLLAR = 0.07
WHITE, BLUE, UNK = 0, 1, -1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
body = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
body.name = body.data.name = "Mascot"
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def count_islands(bm):
    bm.verts.ensure_lookup_table()
    seen = np.zeros(len(bm.verts), bool)
    count = 0
    for v in bm.verts:
        if seen[v.index]:
            continue
        count += 1
        seen[v.index] = True
        stack = [v]
        while stack:
            cur = stack.pop()
            for e in cur.link_edges:
                o = e.other_vert(cur)
                if not seen[o.index]:
                    seen[o.index] = True
                    stack.append(o)
    return count


# ---------------------------------------------------------------- full-res cleanup
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bm.verts.ensure_lookup_table()
print("verts", len(bm.verts), "islands", count_islands(bm))


def coords():
    return np.array([v.co[:] for v in bm.verts])


def dist_to_polyline(px, pz, pts):
    d = np.full(px.shape, 9.0)
    for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
        abx, abz = bx - ax, bz - az
        L2 = abx * abx + abz * abz
        if L2 < 1e-12:
            continue
        t = np.clip(((px - ax) * abx + (pz - az) * abz) / L2, 0, 1)
        d = np.minimum(d, np.hypot(px - ax - t * abx, pz - az - t * abz))
    return d


# measured: Meshy's eye sockets disturb the surface out to r~0.08, the smile ridge to ~0.015
EYE_FILL_R, SMILE_FILL_D = 0.088, 0.024
co = coords()
x, y, z = co.T
front = y < -0.06
mask = np.zeros(len(co), bool)
for e in feat["eyes"]:
    mask |= front & (np.hypot(x - e["cx"], z - e["cz"]) < EYE_FILL_R)
sm = np.array(feat["smile"]["points"])
mask |= front & (np.abs(x) < 0.085) & (dist_to_polyline(x, z, sm) < SMILE_FILL_D)

import subprocess, tempfile, os
bm.faces.ensure_lookup_table()
tris = np.array([[v.index for v in f.verts] for f in bm.faces if len(f.verts) == 3])
tmp = tempfile.mkdtemp()
np.savez(f"{tmp}/in.npz", co=co, tris=tris, mask=mask)
print(subprocess.run(["python3", "-I", os.path.join(os.path.dirname(__file__), "fill.py"),
                      f"{tmp}/in.npz", f"{tmp}/out.npz"], check=True, capture_output=True, text=True).stdout.strip())
new = np.load(f"{tmp}/out.npz")["co"]
for idx in np.nonzero(mask)[0]:
    bm.verts[idx].co = Vector(new[idx])

# gentle smoothing of the whole head removes Meshy's seam ridge and leftover noise
head_verts = [v for v in bm.verts if v.co.z > 0.1]
for _ in range(25):
    bmesh.ops.smooth_vert(bm, verts=head_verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(body.data)
bm.free()

# ---------------------------------------------------------------- decimate
mod = body.modifiers.new("dec", "DECIMATE")
mod.ratio = DECIMATE
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.shade_smooth()
me = body.data
print("decimated verts", len(me.vertices), "tris", sum(len(p.vertices) - 2 for p in me.polygons))

bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # web renders single-sided: normals must face out
bm.normal_update()

# Meshy's mesh is double-walled (~40% of faces are a hidden inner shell). The inner wall gets its
# own skin weights, moves differently and breaks through when posed, so remove it: a face is
# interior when every ray over its outward hemisphere is blocked AND it faces a real cavity
# (> 3 cm), so narrow crevices between fingers / under the arms are kept.
rng = np.random.default_rng(0)
dirs = rng.normal(size=(48, 3))
dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
bvh_all = BVHTree.FromBMesh(bm)
interior = []
for f in bm.faces:
    n = f.normal
    p = f.calc_center_median() + n * 1e-3
    first = bvh_all.ray_cast(p, n)
    if first[0] is None or first[3] < 0.03:
        continue
    if all(bvh_all.ray_cast(p, Vector(d) if Vector(d).dot(n) > 0 else -Vector(d))[0] is not None for d in dirs):
        interior.append(f)
print(f"interior faces removed: {len(interior)} of {len(bm.faces)}")
bmesh.ops.delete(bm, geom=interior, context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
# Close only small gaps; larger openings are where the inner wall met the outer one (cuffs, hems)
# and stay open (materials are double-sided). No second normal recalc: it orients each open island
# on its own and flips some inward; the orientation computed on the closed mesh is already correct.
edges_open = [e for e in bm.edges if e.is_boundary]
filled = bmesh.ops.holes_fill(bm, edges=edges_open, sides=12)
bmesh.ops.triangulate(bm, faces=filled["faces"])
print(f"open boundary edges after removal: {len(edges_open)}, small holes closed: {len(filled['faces'])}")
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
bm.normal_update()
bvh = BVHTree.FromBMesh(bm)
co = coords()
nrm = np.array([v.normal[:] for v in bm.verts])
N = len(co)

# ---------------------------------------------------------------- colour labels from the PNG
img = bpy.data.images.load(REF_PNG)
W, H = img.size
px = np.array(img.pixels[:]).reshape(H, W, 4)[::-1]  # row 0 = top, sRGB floats
pu = np.clip(np.round(reg["ax"] * co[:, 0] + reg["bx"]).astype(int), 0, W - 1)
pv = np.clip(np.round(reg["az"] * co[:, 2] + reg["bz"]).astype(int), 0, H - 1)
s = px[pv, pu] * 255
r, g, b, a = s.T
lum = s[:, :3].mean(1)
label = np.full(N, WHITE)
label[(b > r + 60) & (b > g + 30)] = BLUE
label[(a < 128) | (lum < 70)] = UNK

visible = np.zeros(N, bool)
for i in range(N):
    o = Vector(co[i]) + Vector((0, -6e-4, 0))
    visible[i] = bvh.ray_cast(o, Vector((0, -1, 0)))[0] is None
confident = visible & (nrm[:, 1] < -0.35) & (label != UNK)

arms = (np.abs(co[:, 0]) > 0.19) & (co[:, 2] < 0.06)
label[arms] = WHITE
confident |= arms

# back of the torso is coat (front projection would paint the V-neck through it)
torso = (co[:, 2] > Z_HEM) & (co[:, 2] < Z_COLLAR) & (np.abs(co[:, 0]) < 0.2)
bins = np.digitize(co[:, 2], np.linspace(-0.5, 0.5, 41))
med_y = np.zeros(N)
for k in np.unique(bins):
    m = bins == k
    med_y[m] = np.median(co[m, 1])
back = torso & ~confident & (co[:, 1] > med_y)
label[back] = WHITE
confident |= back
label[co[:, 2] > Z_HEAD] = WHITE
confident |= co[:, 2] > Z_HEAD

# propagate confident labels across the surface (nearest by geodesic edge distance)
adj = [[] for _ in range(N)]
for e in bm.edges:
    i, j = e.verts[0].index, e.verts[1].index
    w = e.calc_length()
    adj[i].append((j, w))
    adj[j].append((i, w))
dist = np.full(N, np.inf)
heap = []
for i in np.nonzero(confident)[0]:
    dist[i] = 0
    heap.append((0.0, int(i)))
heapq.heapify(heap)
while heap:
    d, i = heapq.heappop(heap)
    if d > dist[i]:
        continue
    for j, w in adj[i]:
        if d + w < dist[j]:
            dist[j] = d + w
            label[j] = label[i]
            heapq.heappush(heap, (d + w, j))
label[label == UNK] = WHITE

for _ in range(3):  # majority filter
    new = label.copy()
    for i in range(N):
        votes = [label[j] for j, _ in adj[i]] + [label[i]]
        new[i] = max(set(votes), key=votes.count)
    label = new
print("labels: blue", int((label == BLUE).sum()), "white", int((label == WHITE).sum()))

# ---------------------------------------------------------------- materials
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


MATS = {
    "Tooth": make_mat("Tooth", (248, 245, 247), 0.22, coat=0.6, coat_rough=0.08),
    "Coat": make_mat("Coat", (246, 246, 249), 0.55),
    "Scrubs": make_mat("Scrubs", (8, 74, 208), 0.65),
    "Shoe": make_mat("Shoe", (246, 246, 249), 0.3, coat=0.3),
    "Hand": make_mat("Hand", (248, 245, 247), 0.25, coat=0.5, coat_rough=0.1),
}
ORDER = ["Tooth", "Coat", "Scrubs", "Shoe", "Hand"]
for n in ORDER:
    me.materials.append(MATS[n])
TOOTH, COAT, SCRUBS, SHOE = 0, 1, 2, 3

def shoe_line(yy):
    # pants cuff meets the shoe higher at the toe than at the heel (measured from side closeup)
    return -0.43 - 0.352 * (yy + 0.019)


for f in bm.faces:
    ids = [v.index for v in f.verts]
    cy = sum(co[i, 1] for i in ids) / 3
    cz = sum(co[i, 2] for i in ids) / 3
    blue = sum(label[i] == BLUE for i in ids) >= 2
    if cz > Z_HEAD:
        f.material_index = TOOTH
    elif cz < shoe_line(cy):
        f.material_index = SHOE
    elif cz < Z_HEM - 0.012 or blue:
        f.material_index = SCRUBS
    else:
        f.material_index = COAT


def drop_specks(min_faces=80):
    """Small same-material patches are projection noise: give them the neighbours' material."""
    seen = set()
    changed = 0
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

# straighten the zig-zag where materials meet, keeping vertices on the surface
ref_bvh = BVHTree.FromBMesh(bm)
for _ in range(12):
    moves = {}
    for v in bm.verts:
        nb = [e.other_vert(v) for e in v.link_edges
              if len(e.link_faces) == 2 and e.link_faces[0].material_index != e.link_faces[1].material_index]
        if len(nb) == 2 and len({f.material_index for f in v.link_faces}) == 2:
            moves[v] = (nb[0].co + nb[1].co) / 2
    for v, target in moves.items():
        p = v.co.lerp(target, 0.5)
        v.co = ref_bvh.find_nearest(p)[0]
bm.to_mesh(me)
bm.free()
print("mesh validate fixed problems:", me.validate(verbose=False))
me.update()

# ---------------------------------------------------------------- eyes + smile
bm = bmesh.new()
bm.from_mesh(me)
bvh = BVHTree.FromBMesh(bm)
bm.free()


def surface(xx, zz):
    hit = bvh.ray_cast(Vector((xx, -2, zz)), Vector((0, 1, 0)))
    n = hit[1] if hit[1].y < 0 else -hit[1]  # Meshy winding is unreliable: face the camera (-Y)
    return hit[0], n




eye_img = bpy.data.images.load(EYE_PNG)
eye_img.pack()
eye_mat = bpy.data.materials.new("Eye")
eye_mat.use_nodes = True
nt = eye_mat.node_tree
p = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = eye_img
nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
p.inputs["Emission Strength"].default_value = 0.35
# the highlight is painted into the texture; keep live reflections faint so the eye stays deep navy
p.inputs["Roughness"].default_value = 0.2
p.inputs["Specular IOR Level"].default_value = 0.25
p.inputs["Coat Weight"].default_value = 0.3
p.inputs["Coat Roughness"].default_value = 0.05
eye_mat.diffuse_color = (0.01, 0.015, 0.05, 1)

smile_mat = make_mat("Smile", (22, 26, 46), 0.3, coat=0.4)


def build_eye(name, e, tilt):
    cx, cz = e["cx"], e["cz"]
    rx, rz = e["rx"] * 1.02, e["rz"] * 1.02
    _, n0 = surface(cx, cz)
    NR, NS, H_DOME = 16, 64, 0.0085
    t_rot = math.radians(tilt)
    bm_ = bmesh.new()
    uv = bm_.loops.layers.uv.new("UVMap")
    rings, uvs = [], []
    center_uv = (0.5, 0.5)
    loc, _ = surface(cx, cz)
    center = bm_.verts.new(loc + n0 * (H_DOME + 0.0006))
    for i in range(1, NR + 2):
        t = min(i / NR, 1.0)
        ring, ring_uv = [], []
        for j in range(NS):
            th = 2 * math.pi * j / NS
            lx, lz = rx * t * math.cos(th), rz * t * math.sin(th)
            wx = cx + lx * math.cos(t_rot) - lz * math.sin(t_rot)
            wz = cz + lx * math.sin(t_rot) + lz * math.cos(t_rot)
            hit, _ = surface(wx, wz)
            if i <= NR:
                h = H_DOME * (1 - t * t) ** 0.55 + 0.0006
            else:
                h = -0.003  # skirt tucked into the head so the edge never shows a gap
            ring.append(bm_.verts.new(hit + n0 * h))
            ring_uv.append((0.5 + 0.5 * t * math.cos(th), 0.5 + 0.5 * t * math.sin(th)))
        rings.append(ring)
        uvs.append(ring_uv)
    for j in range(NS):
        k = (j + 1) % NS
        f = bm_.faces.new((center, rings[0][j], rings[0][k]))
        for loop, uvv in zip(f.loops, (center_uv, uvs[0][j], uvs[0][k])):
            loop[uv].uv = uvv
    for i in range(len(rings) - 1):
        for j in range(NS):
            k = (j + 1) % NS
            f = bm_.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][k], rings[i][k]))
            for loop, uvv in zip(f.loops, (uvs[i][j], uvs[i + 1][j], uvs[i + 1][k], uvs[i][k])):
                loop[uv].uv = uvv
    bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces)
    m = bpy.data.meshes.new(name)
    bm_.to_mesh(m)
    bm_.free()
    o = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(o)
    m.materials.append(eye_mat)
    for poly in m.polygons:
        poly.use_smooth = True
    return o


# eyes tilt outward slightly at the top, mirrored
eyeR = build_eye("Eye.R", feat["eyes"][0], tilt=3.5)   # character's right = -x
eyeL = build_eye("Eye.L", feat["eyes"][1], tilt=-3.5)

def build_tube(name, xz_points, radius, lift=0.0015, sink=0.0):
    """A round-capped tube that hugs the face along the given (x, z) points."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(xz_points) - 1)
    path = []
    for pnt, (mx, mz) in zip(sp.points, xz_points):
        hit, n = surface(mx, mz)
        q = hit + n * lift + Vector((0, sink, 0))
        pnt.co = (q.x, q.y, q.z, 1)
        path.append(q)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    cu.materials.append(smile_mat)
    caps = []
    for end in (path[0], path[-1]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=16, ring_count=8, location=end)
        caps.append(bpy.context.active_object)
    for o in bpy.context.scene.objects:
        o.select_set(o == obj or o in caps)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(smile_mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
        poly.material_index = 0
    return obj


pts = np.array(feat["smile"]["points"])
coef = np.polyfit(pts[:, 0], pts[:, 1], 2)
coef[1] = 0.0  # keep it symmetric
xs = np.linspace(pts[:, 0].min(), pts[:, 0].max(), 40)
xs = (xs - xs.mean())
zs = np.polyval(coef, xs + pts[:, 0].mean())
build_tube("Smile", [(xx + pts[:, 0].mean(), zz) for xx, zz in zip(xs, zs)], 0.0052)

# closed-eye arcs (as in mascot.png), parked inside the head; animations slide them out
LID_DEPTH = 0.02
for name, e, tilt in (("Lid.R", feat["eyes"][0], 3.5), ("Lid.L", feat["eyes"][1], -3.5)):
    cx, cz = e["cx"], e["cz"]
    half = e["rx"] * 1.05
    t = math.radians(tilt)
    arc = []
    for lx in np.linspace(-half, half, 30):
        lz = -0.012 + 0.02 * (lx / half) ** 2
        arc.append((cx + lx * math.cos(t) - lz * math.sin(t), cz + lx * math.sin(t) + lz * math.cos(t)))
    build_tube(name, arc, 0.0058, sink=LID_DEPTH)
bpy.context.scene["lid_depth"] = LID_DEPTH

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("saved", OUT_BLEND)
